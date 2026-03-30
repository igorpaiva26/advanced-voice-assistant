import { useRef, useState, useCallback, useEffect } from 'react';

export type ListeningState = 'idle' | 'listening' | 'processing';

interface UseSpeechRecognitionResult {
  listeningState: ListeningState;
  startListening: () => void;
  stopListening: () => void;
  supported: boolean;
  error: string | null;
}

// Tipos que o TS não inclui por padrão para SpeechRecognition
interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: ISpeechRecognition, ev: ISpeechRecognitionEvent) => void) | null;
  onerror: ((this: ISpeechRecognition, ev: ISpeechRecognitionErrorEvent) => void) | null;
}

interface ISpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface ISpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface ISpeechRecognitionConstructor {
  new (): ISpeechRecognition;
}

function getSR(): ISpeechRecognitionConstructor | null {
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition(
  onResult: (text: string) => void
): UseSpeechRecognitionResult {
  const supported = !!getSR();
  const [listeningState, setListeningState] = useState<ListeningState>('idle');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const activeRef = useRef(false);
  const onResultRef = useRef(onResult);

  // Mantém a referência atualizada sem recriar o recognition
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const stopListening = useCallback(() => {
    activeRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListeningState('idle');
  }, []);

  const startListening = useCallback(() => {
    const SR = getSR();
    if (!SR) {
      setError('Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.');
      return;
    }
    if (activeRef.current) return;

    setError(null);
    activeRef.current = true;

    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;

    rec.onstart = () => setListeningState('listening');

    rec.onresult = (event: ISpeechRecognitionEvent) => {
      const last = event.results[event.results.length - 1];
      if (last.isFinal) {
        const text = last[0].transcript.trim();
        if (text) {
          setListeningState('processing');
          onResultRef.current(text);
          setTimeout(() => {
            if (activeRef.current) setListeningState('listening');
          }, 600);
        }
      }
    };

    rec.onerror = (event: ISpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed') {
        setError('Permissão de microfone negada. Permita o acesso nas configurações do navegador.');
        activeRef.current = false;
        setListeningState('idle');
        return;
      }
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      setError(`Erro no reconhecimento: ${event.error}`);
    };

    rec.onend = () => {
      // Reinicia automaticamente para manter escuta contínua
      if (activeRef.current) {
        try { rec.start(); } catch { /* já rodando */ }
      } else {
        setListeningState('idle');
      }
    };

    rec.start();
  }, []);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  return { listeningState, startListening, stopListening, supported, error };
}
