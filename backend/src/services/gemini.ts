/**
 * Serviço centralizado para o Google Gemini.
 * Usado para: chat de texto COM TOOLS, análise de tela (visão) e áudio.
 * 
 * O Gemini agora é o LLM principal para TUDO (chat, tools, vision).
 * O Groq fica apenas para STT (Whisper).
 */

import fetch from 'node-fetch';
import { loadEnv } from '../types/env';
import SYSTEM_PROMPT from '../prompt';
import { AGENT_PROFILES } from '../agents';
import { TOOLS } from '../tools/definitions';
import { executeTool } from '../tools/executor';
import { geminiRateLimiter } from '../utils/rateLimiter';

const env = loadEnv();

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

// ─── CONVERSÃO DE FORMATOS ──────────────────────────────────────────────────

// Converte histórico do formato interno para o formato Gemini
function toGeminiHistory(history: ChatMessage[]) {
  return history
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
}

// Converte tools do formato OpenAI para o formato Gemini function_declarations
function toGeminiFunctionDeclarations() {
  return TOOLS.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description,
    parameters: tool.function.parameters,
  }));
}

// ─── CHAMADA GEMINI GENÉRICA (sem tools) ────────────────────────────────────

async function callGemini(contents: object[], agentId?: string, customPrompt?: string): Promise<string> {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada. Adicione no backend/.env');
  }

  let finalPrompt = SYSTEM_PROMPT;
  if (agentId === 'custom' && customPrompt && customPrompt.trim() !== '') {
    finalPrompt = customPrompt;
  } else if (agentId && AGENT_PROFILES[agentId]) {
    finalPrompt = AGENT_PROFILES[agentId];
  }

  const visionSystemNote = `\nREGRAS EXTRAS PARA ANÁLISE DE TELA (MUITO IMPORTANTE): 
- Descreva a tela de forma extremamente objetiva e direta. Diga apenas o que viu e pronto.
- Use no máximo 2 ou 3 frases. 
- NUNCA use listas (1., 2.) ou marcadores (*). 
- NUNCA use formatação Markdown como negritos (**) ou itálicos. Responda apenas em texto corrido e puro.`;

  const body = {
    system_instruction: { parts: [{ text: finalPrompt + visionSystemNote }] },
    contents,
    generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
  };

  // Rate limiting
  await geminiRateLimiter.waitIfNeeded();

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`[gemini] Erro: ${res.status}`);
    throw new Error(`Gemini retornou ${res.status}: ${err}`);
  }

  const data = (await res.json()) as any;
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ─── CHAMADA GEMINI COM TOOLS (function calling) ────────────────────────────

async function callGeminiWithTools(
  contents: object[],
  systemPrompt: string
): Promise<{ text?: string; functionCall?: { name: string; args: Record<string, any> } }> {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada.');
  }

  const toolSystemNote = `\nVocê tem ferramentas para controlar o computador do usuário. REGRAS CRÍTICAS:
1. SÓ use uma ferramenta quando o usuário EXPLICITAMENTE pedir uma ação no computador (ex: "abre a calculadora", "aumenta o volume", "pesquisa X no Google").
2. Se a frase for uma PERGUNTA, CONVERSA ou COMENTÁRIO casual, RESPONDA NORMALMENTE com texto.
3. Na dúvida se é um comando ou conversa, RESPONDA com texto. Nunca assuma que é um comando.
4. Após executar uma ferramenta, confirme brevemente o que foi feito.
5. Para desligar/reiniciar, SEMPRE pergunte confirmação antes.`;

  const body: any = {
    system_instruction: { parts: [{ text: systemPrompt + toolSystemNote }] },
    contents,
    tools: [{ function_declarations: toGeminiFunctionDeclarations() }],
    tool_config: { function_calling_config: { mode: 'AUTO' } },
    generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
  };

  // Rate limiting
  await geminiRateLimiter.waitIfNeeded();

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`[gemini] Erro na chamada com tools: ${res.status}`);
    throw new Error(`Gemini retornou ${res.status}: ${err}`);
  }

  const data = (await res.json()) as any;
  const parts = data?.candidates?.[0]?.content?.parts ?? [];

  // Verifica se tem function call
  for (const part of parts) {
    if (part.functionCall) {
      return {
        functionCall: {
          name: part.functionCall.name,
          args: part.functionCall.args || {},
        },
      };
    }
  }

  // Sem function call → retorna texto
  const text = parts.find((p: any) => p.text)?.text ?? '';
  return { text };
}

// ─── CHAT COM TOOLS (PRINCIPAL) ─────────────────────────────────────────────

export async function generateChatReply(
  message: string,
  history: ChatMessage[],
  agentId?: string,
  customPrompt?: string
): Promise<string> {
  let finalPrompt = SYSTEM_PROMPT;
  if (agentId === 'custom' && customPrompt && customPrompt.trim() !== '') {
    finalPrompt = customPrompt;
  } else if (agentId && AGENT_PROFILES[agentId]) {
    finalPrompt = AGENT_PROFILES[agentId];
  }

  console.log(`[gemini] Chat+Tools: "${message.slice(0, 60)}" (histórico: ${history.length})`);

  const contents = [
    ...toGeminiHistory(history),
    { role: 'user', parts: [{ text: message }] },
  ];

  // Primeira chamada — pode retornar texto OU function call
  const firstResponse = await callGeminiWithTools(contents, finalPrompt);

  // Se obteve uma function call
  if (firstResponse.functionCall) {
    const { name, args } = firstResponse.functionCall;
    console.log(`[gemini] Function call: ${name}(${JSON.stringify(args)})`);

    // Executa a tool
    const result = await executeTool(name, args);
    console.log(`[gemini] Tool result: ${result}`);

    // Segunda chamada com o resultado da tool para gerar resposta natural
    const contentsWithResult = [
      ...contents,
      {
        role: 'model',
        parts: [{ functionCall: { name, args } }],
      },
      {
        role: 'user',
        parts: [{
          functionResponse: {
            name,
            response: { result },
          },
        }],
      },
    ];

    try {
      // Chamada sem tools para gerar resposta natural de confirmação
      const body = {
        system_instruction: { parts: [{ text: finalPrompt + '\nConfirme brevemente o que foi feito. Seja natural e direto.' }] },
        contents: contentsWithResult,
        generationConfig: { maxOutputTokens: 256, temperature: 0.7 },
      };

      // Rate limiting
      await geminiRateLimiter.waitIfNeeded();

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      if (res.ok) {
        const data = (await res.json()) as any;
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) {
          console.log(`[gemini] Resposta após tool: "${reply.slice(0, 80)}"`);
          return reply;
        }
      }
    } catch (e) {
      console.warn('[gemini] Falha na segunda chamada, retornando resultado direto.');
    }

    // Fallback: retorna resultado cru da tool
    return result;
  }

  // Sem function call — resposta normal de texto
  const reply = firstResponse.text || '';
  console.log(`[gemini] Resposta: "${reply.slice(0, 80)}"`);
  return reply;
}

// ─── AUDIO ──────────────────────────────────────────────────────────────────

// Áudio direto: transcreve e responde em uma única chamada
export async function generateAudioReply(
  audioBase64: string,
  mimeType: string,
  history: ChatMessage[],
  agentId?: string,
  customPrompt?: string
): Promise<{ transcription: string; reply: string }> {
  console.log('[gemini] Audio: transcrevendo e respondendo...');

  const contents = [
    ...toGeminiHistory(history),
    {
      role: 'user',
      parts: [
        { inline_data: { mime_type: mimeType, data: audioBase64 } },
        { text: 'Transcreva exatamente o que foi dito no áudio acima e responda à mensagem. Formato da resposta: TRANSCRICAO: <texto transcrito>\nRESPOSTA: <sua resposta>' },
      ],
    },
  ];

  const raw = await callGemini(contents, agentId, customPrompt);
  console.log(`[gemini] Audio raw: "${raw.slice(0, 120)}"`);

  const transcricaoMatch = raw.match(/TRANSCRICAO:\s*(.+?)(?:\n|$)/i);
  const respostaMatch = raw.match(/RESPOSTA:\s*([\s\S]+)/i);

  const transcription = transcricaoMatch?.[1]?.trim() ?? raw;
  const reply = respostaMatch?.[1]?.trim() ?? raw;

  return { transcription, reply };
}

// ─── VISION ─────────────────────────────────────────────────────────────────

// Chat com frame de tela + áudio
export async function analyzeScreenWithAudio(
  audioBase64: string,
  audioMime: string,
  imageBase64: string,
  imageMime: string,
  history: ChatMessage[],
  agentId?: string,
  customPrompt?: string
): Promise<{ transcription: string; reply: string }> {
  console.log('[gemini] AudioVision: transcrevendo + analisando tela...');

  const contents = [
    ...toGeminiHistory(history),
    {
      role: 'user',
      parts: [
        { inline_data: { mime_type: audioMime, data: audioBase64 } },
        { inline_data: { mime_type: imageMime, data: imageBase64 } },
        { text: 'Transcreva exatamente o que foi dito no áudio e responda considerando a imagem da tela. Formato: TRANSCRICAO: <texto>\nRESPOSTA: <resposta>' },
      ],
    },
  ];

  const raw = await callGemini(contents, agentId, customPrompt);
  const transcription = raw.match(/TRANSCRICAO:\s*(.+?)(?:\n|$)/i)?.[1]?.trim() ?? raw;
  const reply = raw.match(/RESPOSTA:\s*([\s\S]+)/i)?.[1]?.trim() ?? raw;
  return { transcription, reply };
}

// Chat com frame de tela (visão) — texto
export async function analyzeScreen(
  imageBase64: string,
  mimeType: string,
  userMessage: string,
  history: ChatMessage[],
  agentId?: string,
  customPrompt?: string
): Promise<string> {
  console.log(`[gemini] Vision: "${userMessage.slice(0, 60)}"`);

  const contents = [
    ...toGeminiHistory(history),
    {
      role: 'user',
      parts: [
        { inline_data: { mime_type: mimeType, data: imageBase64 } },
        { text: userMessage },
      ],
    },
  ];

  const reply = await callGemini(contents, agentId, customPrompt);
  console.log(`[gemini] Vision resposta: "${reply.slice(0, 80)}"`);
  return reply;
}
