import { useState, useCallback, useRef } from 'react';
import { ChatMessage } from './types/chat';
import { sendChatMessage, sendVisionMessage, transcribeAudio } from './services/api';
import { useVoiceListener } from './hooks/useVoiceListener';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import { useScreenShare } from './hooks/useScreenShare';
import { ChatWindow } from './components/ChatWindow';
import { ChatInput } from './components/ChatInput';
import { Controls } from './components/Controls';
import { StatusBar } from './components/StatusBar';
import { AgentSelector, AgentType } from './components/AgentSelector';
import { RateLimitMonitor } from './components/RateLimitMonitor';

function makeId() {
  return Math.random().toString(36).slice(2);
}

function cleanTextForSpeech(text: string): string {
  // Remove markdown symbols (asterisks, hashtags, underscores, code backticks)
  return text.replace(/[*_~`#]/g, '');
}

function makeMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return { id: makeId(), role, content, timestamp: new Date() };
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  
  const [agentId, setAgentId] = useState<AgentType>('default');
  const [customPrompt, setCustomPrompt] = useState<string>('');

  const pauseRef = useRef<() => void>(() => {});
  const resumeRef = useRef<() => void>(() => {});

  const { speak, muted, toggleMute } = useSpeechSynthesis({
    onSpeakEnd: () => resumeRef.current(),
  });

  const pushMessage = useCallback((role: ChatMessage['role'], content: string) => {
    const msg = makeMessage(role, content);
    setMessages((prev) => [...prev, msg]);
    return msg;
  }, []);

  // captureFrameRef preenchido após useScreenShare ser inicializado
  const captureFrameRef = useRef<() => { base64: string; mimeType: string } | null>(() => null);

  const askAssistant = useCallback(
    async (userText: string, history: ChatMessage[]) => {
      setLoading(true);
      setAppError(null);
      try {
        const apiHistory = history.map((m) => ({ role: m.role, content: m.content }));
        const frame = captureFrameRef.current();
        let reply: string;

        if (frame) {
          // Tela compartilhada: usa Gemini Vision
          reply = await sendVisionMessage(frame.base64, frame.mimeType, userText, apiHistory, agentId, customPrompt);
        } else {
          // Sem tela: usa Groq Chat normal
          reply = await sendChatMessage(userText, apiHistory, agentId, customPrompt);
        }

        pushMessage('assistant', reply);
        pauseRef.current();
        await speak(cleanTextForSpeech(reply));
      } catch (err: any) {
        setAppError(err.message ?? 'Erro ao obter resposta do assistente.');
      } finally {
        setLoading(false);
      }
    },
    [pushMessage, speak, agentId, customPrompt]
  );

  const handleScreenStart = useCallback(() => {
    // Silencioso: não anuncia que está vendo a tela
  }, []);

  const handleScreenStop = useCallback(() => {
    // Silencioso: não anuncia que parou de ver a tela
  }, []);

  const { isSharing, startSharing, stopSharing, captureFrame, error: screenError } = useScreenShare(
    handleScreenStart,
    handleScreenStop
  );

  captureFrameRef.current = captureFrame;

  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const handleAudioReady = useCallback(
    async (blob: Blob) => {
      setAppError(null);
      setLoading(true);
      const t0 = performance.now();
      try {
        const history = [...messagesRef.current];
        const apiHistory = history.map((m) => ({ role: m.role, content: m.content }));

        // Captura frame ANTES de iniciar STT para ganhar tempo
        const t1 = performance.now();
        const frame = captureFrameRef.current();
        console.log(`[timing] Frame capturado em ${(performance.now() - t1).toFixed(0)}ms`);

        // STT roda sozinho agora
        const t2 = performance.now();
        const text = await transcribeAudio(blob).catch(async (err) => {
          const msg = 'Não entendi o que você falou, pode falar mais próximo do microfone e um pouco mais alto?';
          pushMessage('assistant', msg);
          pauseRef.current();
          await speak(cleanTextForSpeech(msg));
          return '';
        });
        console.log(`[timing] STT completou em ${(performance.now() - t2).toFixed(0)}ms`);

        if (!text.trim()) return;
        
        // Detecta comandos de controle de tela
        const textLower = text.toLowerCase();
        console.log('[comando] Texto recebido:', textLower);
        
        // Ativar: busca por palavras-chave de ativação + tela/compartilhamento
        const hasActivateWord = /(ativ[ae]|compartilh[ae]|mostr[ae]|inicia|liga|abre?|escriva|ativa)/i.test(textLower);
        const hasScreenWord = /(tela|compartilhamento|screen)/i.test(textLower);
        const isScreenShareCommand = hasActivateWord && hasScreenWord && !isSharing;
        
        // Desativar: busca por palavras-chave de desativação + tela/compartilhamento
        const hasDeactivateWord = /(desativ[ae]|parar?|encerr[ae]|deslig[ae]|fech[ae]|finaliz[ae])/i.test(textLower);
        const isScreenStopCommand = hasDeactivateWord && hasScreenWord && isSharing;
        
        console.log('[comando] isScreenShareCommand:', isScreenShareCommand, 'isSharing:', isSharing);
        console.log('[comando] isScreenStopCommand:', isScreenStopCommand, 'isSharing:', isSharing);
        
        if (isScreenShareCommand && !isSharing) {
          setMessages((prev) => [...prev, makeMessage('user', text)]);
          await startSharing();
          const msg = 'Compartilhamento ativado.';
          pushMessage('assistant', msg);
          pauseRef.current();
          await speak(msg);
          return;
        }
        
        if (isScreenStopCommand && isSharing) {
          console.log('[comando] Executando stopSharing...');
          setMessages((prev) => [...prev, makeMessage('user', text)]);
          stopSharing();
          console.log('[comando] stopSharing executado');
          const msg = 'Pronto, parei de ver sua tela.';
          pushMessage('assistant', msg);
          pauseRef.current();
          await speak(msg);
          return;
        }
        
        setMessages((prev) => [...prev, makeMessage('user', text)]);

        const t3 = performance.now();
        const reply = frame
          ? await sendVisionMessage(frame.base64, frame.mimeType, text, apiHistory, agentId, customPrompt)
          : await sendChatMessage(text, apiHistory, agentId, customPrompt);
        console.log(`[timing] ${frame ? 'Vision' : 'Chat'} completou em ${(performance.now() - t3).toFixed(0)}ms`);

        pushMessage('assistant', reply);
        pauseRef.current();
        
        const t4 = performance.now();
        await speak(cleanTextForSpeech(reply));
        console.log(`[timing] TTS completou em ${(performance.now() - t4).toFixed(0)}ms`);
        console.log(`[timing] TOTAL: ${(performance.now() - t0).toFixed(0)}ms`);
      } catch (err: any) {
        setAppError(err.message ?? 'Erro ao processar áudio.');
      } finally {
        setLoading(false);
      }
    },
    [pushMessage, speak, isSharing, startSharing, stopSharing, agentId, customPrompt]
  );

  const { listeningState, startListening, stopListening, pauseListening, resumeListening, error: voiceError } =
    useVoiceListener(handleAudioReady);

  pauseRef.current = pauseListening;
  resumeRef.current = resumeListening;

  const handleSend = useCallback(
    (text: string) => {
      const history = [...messages];
      pushMessage('user', text);
      void askAssistant(text, history);
    },
    [messages, pushMessage, askAssistant]
  );

  const error = appError ?? voiceError ?? screenError;

  return (
    <div className="app">
      <RateLimitMonitor />
      
      <header className="app__header">
        <h1>🤖 AI Screen Assistant</h1>
        <span className="app__badge">
          {isSharing ? '👁️ Gemini Vision' : '🎙️ Edge TTS'}
        </span>
      </header>

      <AgentSelector 
        agentId={agentId} 
        setAgentId={setAgentId} 
        customPrompt={customPrompt} 
        setCustomPrompt={setCustomPrompt} 
      />

      <StatusBar
        listeningState={listeningState}
        isSharing={isSharing}
        muted={muted}
        error={error}
      />

      <ChatWindow messages={messages} />

      <div className="app__footer">
        <Controls
          listeningState={listeningState}
          isSharing={isSharing}
          muted={muted}
          supported={true}
          onStartListening={startListening}
          onStopListening={stopListening}
          onStartSharing={startSharing}
          onStopSharing={stopSharing}
          onToggleMute={toggleMute}
        />
        <ChatInput onSend={handleSend} disabled={loading} />
      </div>
    </div>
  );
}
