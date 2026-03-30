/**
 * Serviço centralizado para chamadas à API da Groq.
 *
 * Para trocar de provider (ex: OpenAI), basta:
 * 1. Alterar GROQ_BASE_URL no .env para o endpoint do novo provider
 * 2. Alterar GROQ_API_KEY para a chave do novo provider
 * 3. Ajustar os modelos nas variáveis GROQ_CHAT_MODEL e GROQ_STT_MODEL
 *
 * A interface das funções abaixo permanece a mesma — as rotas não precisam mudar.
 */

import fetch from 'node-fetch';
import FormData from 'form-data';
import { loadEnv } from '../types/env';
import SYSTEM_PROMPT from '../prompt';
import { AGENT_PROFILES } from '../agents';
import { TOOLS } from '../tools/definitions';
import { executeTool } from '../tools/executor';

const env = loadEnv();

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const form = new FormData();
  // Groq STT aceita o campo "file" com o áudio e "model" com o nome do modelo
  form.append('file', audioBuffer, {
    filename: 'audio.webm',
    contentType: mimeType || 'audio/webm',
  });
  form.append('model', env.GROQ_STT_MODEL);
  form.append('language', 'pt');
  form.append('response_format', 'json');

  console.log(`[groq] Transcrevendo áudio (${audioBuffer.length} bytes) com modelo ${env.GROQ_STT_MODEL}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.GROQ_TIMEOUT_MS);

  try {
    const res = await fetch(`${env.GROQ_BASE_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        ...form.getHeaders(),
      },
      body: form,
      signal: controller.signal as any,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[groq] Erro na transcrição: ${res.status} ${err}`);
      throw new Error(`Groq STT retornou ${res.status}: ${err}`);
    }

    const data = (await res.json()) as { text: string };
    console.log(`[groq] Transcrição concluída: "${data.text}"`);
    return data.text ?? '';
  } finally {
    clearTimeout(timeout);
  }
}

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

  // Instrução sobre tools — MUITO restritiva para evitar chamadas indevidas
  const toolSystemNote = `\nVocê tem ferramentas para controlar o computador do usuário. REGRAS CRÍTICAS:
1. SÓ use uma ferramenta quando o usuário EXPLICITAMENTE pedir uma ação no computador (ex: "abre a calculadora", "aumenta o volume", "pesquisa X").
2. Se a frase do usuário for uma PERGUNTA, CONVERSA ou COMENTÁRIO casual, RESPONDA NORMALMENTE com texto. NÃO chame nenhuma ferramenta.
3. Na dúvida se é um comando ou conversa, RESPONDA com texto. Nunca assuma que é um comando.
4. Após executar uma ferramenta, confirme brevemente o que foi feito.
5. Para desligar/reiniciar, SEMPRE pergunte confirmação antes.`;

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: finalPrompt + toolSystemNote,
    },
    ...history,
    { role: 'user', content: message },
  ];

  console.log(`[groq] Gerando resposta para: "${message}" (histórico: ${history.length} msgs)`);

  // Primeira chamada — pode retornar texto OU tool_calls
  const firstResponse = await callGroqChat(messages);

  // Se a IA decidiu chamar uma tool
  if (firstResponse.tool_calls && firstResponse.tool_calls.length > 0) {
    console.log(`[groq] IA acionou ${firstResponse.tool_calls.length} tool(s)`);

    // Executa cada tool e coleta resultados
    const toolResults: string[] = [];
    for (const toolCall of firstResponse.tool_calls) {
      const fnName = toolCall.function.name;
      let fnArgs: Record<string, any> = {};
      
      try {
        fnArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        fnArgs = {};
      }

      console.log(`[groq] Executando tool: ${fnName}`, fnArgs);
      const result = await executeTool(fnName, fnArgs);
      console.log(`[groq] Resultado da tool: ${result}`);
      toolResults.push(result);
    }

    // Segunda chamada para gerar resposta natural confirmando a ação
    const toolSummary = toolResults.join('; ');
    try {
      const confirmationMessages: ChatMessage[] = [
        { role: 'system', content: finalPrompt },
        { role: 'user', content: message },
        { role: 'assistant', content: `[Ação executada: ${toolSummary}]` },
        { role: 'user', content: 'Confirme brevemente o que fez.' },
      ];
      const finalResponse = await callGroqChat(confirmationMessages, false);
      return finalResponse.content || toolSummary;
    } catch {
      // Se a segunda chamada falhar (rate limit), retorna resultado direto
      return toolSummary;
    }
  }

  // Sem tool_calls — resposta normal de texto
  const reply = firstResponse.content || '';
  console.log(`[groq] Resposta gerada: "${reply.slice(0, 80)}..."`);
  return reply;
}

// Configuração de retry para rate limits
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2000; // 2s, 4s, 8s

// Chamada genérica ao endpoint de chat do Groq com suporte a tools e retry
async function callGroqChat(messages: ChatMessage[], includeTools: boolean = true, retryCount: number = 0): Promise<{
  content: string | null;
  tool_calls?: any[];
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.GROQ_TIMEOUT_MS);

  try {
    const body: any = {
      model: env.GROQ_CHAT_MODEL,
      messages,
    };

    // Só inclui tools na chamada inicial, não na chamada de continuação após resultados de tools
    if (includeTools) {
      body.tools = TOOLS;
      body.tool_choice = 'auto';
    }

    const res = await fetch(`${env.GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal as any,
    });

    if (!res.ok) {
      const errText = await res.text();
      
      // RETRY: Rate limit (429) — espera e tenta de novo
      if (res.status === 429 && retryCount < MAX_RETRIES) {
        const waitMs = RETRY_BASE_MS * Math.pow(2, retryCount);
        console.warn(`[groq] Rate limit (429). Aguardando ${waitMs}ms antes de tentar novamente (tentativa ${retryCount + 1}/${MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        return callGroqChat(messages, includeTools, retryCount + 1);
      }

      // FALLBACK: Groq às vezes gera tool calls em formato XML malformado
      if (res.status === 400 && (errText.includes('tool_use_failed') || errText.includes('tool_call'))) {
        console.warn('[groq] Tool call malformada detectada, tentando extrair via fallback...');
        
        const parsed = parseMalformedToolCall(errText);
        if (parsed) {
          console.log(`[groq] Fallback extraiu: ${parsed.name}(${JSON.stringify(parsed.args)})`);
          return {
            content: null,
            tool_calls: [{
              id: `fallback_${Date.now()}`,
              type: 'function',
              function: {
                name: parsed.name,
                arguments: JSON.stringify(parsed.args),
              },
            }],
          };
        }
      }
      
      console.error(`[groq] Erro no chat: ${res.status} ${errText.slice(0, 200)}`);
      throw new Error(`Groq Chat retornou ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as any;
    const choice = data.choices?.[0]?.message;

    return {
      content: choice?.content ?? null,
      tool_calls: choice?.tool_calls ?? undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// Parser de fallback para quando a Groq gera tool calls em formato XML malformado
// A Groq pode retornar vários formatos escapados que precisamos tratar
function parseMalformedToolCall(errorText: string): { name: string; args: Record<string, any> } | null {
  try {
    console.log(`[groq] Texto de erro bruto (primeiros 500 chars): ${errorText.slice(0, 500)}`);
    
    // Desescapar TODOS os formatos possíveis de unicode escape
    let unescaped = errorText
      // \\u003c -> <  (double escaped)
      .replace(/\\\\u003c/gi, '<')
      .replace(/\\\\u003e/gi, '>')
      // \u003c -> < (single escaped — em string JSON)
      .replace(/\\u003c/gi, '<')
      .replace(/\\u003e/gi, '>')
      // \" -> "
      .replace(/\\"/g, '"')
      // \\ -> \
      .replace(/\\\\/g, '\\')
      // \\n -> space
      .replace(/\\n/g, ' ');

    console.log(`[groq] Texto desescapado (primeiros 500 chars): ${unescaped.slice(0, 500)}`);

    // Lista de todas as tools conhecidas para matching
    const knownTools = [
      'open_application', 'close_application', 'open_website', 'web_search',
      'set_volume', 'toggle_mute', 'play_pause_media', 'next_track', 'previous_track',
      'set_brightness', 'lock_screen', 'system_power', 'cancel_shutdown',
      'toggle_wifi', 'toggle_bluetooth', 'type_text', 'press_keys', 'take_screenshot',
      'manage_window', 'open_folder', 'set_timer', 'get_system_info',
      'empty_recycle_bin', 'eject_media', 'open_settings_page',
    ];

    // Tentativa 1: <function=NOME({ARGS})> (formato mais comum)
    const xmlMatch = unescaped.match(/<function=(\w+)\((\{.*?\})\)/s);
    if (xmlMatch) {
      console.log(`[groq] Fallback match (XML): ${xmlMatch[1]}`);
      try {
        return { name: xmlMatch[1], args: JSON.parse(xmlMatch[2]) };
      } catch {
        // Args malformado, continua tentando
      }
    }

    // Tentativa 2: function=NOME({ARGS}) sem < > 
    const fnMatch = unescaped.match(/function=(\w+)\((\{.*?\})\)/s);
    if (fnMatch) {
      console.log(`[groq] Fallback match (fn=): ${fnMatch[1]}`);
      try {
        return { name: fnMatch[1], args: JSON.parse(fnMatch[2]) };
      } catch {}
    }

    // Tentativa 3: "name": "TOOL_NAME" + "arguments": "{...}" (formato JSON parcial)
    const jsonToolMatch = unescaped.match(/"name"\s*:\s*"(\w+)".*?"arguments"\s*:\s*"(\{.*?\})"/s);
    if (jsonToolMatch && knownTools.includes(jsonToolMatch[1])) {
      console.log(`[groq] Fallback match (JSON): ${jsonToolMatch[1]}`);
      try {
        const argsStr = jsonToolMatch[2].replace(/\\"/g, '"');
        return { name: jsonToolMatch[1], args: JSON.parse(argsStr) };
      } catch {}
    }

    // Tentativa 4: "attempted to call tool 'NOME'" 
    const toolNameMatch = unescaped.match(/(?:attempted to call tool|call tool|tool)\s*'(\w+)'/i);
    if (toolNameMatch) {
      const name = toolNameMatch[1];
      console.log(`[groq] Fallback match (attempted): ${name}`);
      // Busca args JSON no texto completo
      const argsMatch = unescaped.match(/\{[^{}]*"[^"]+"\s*:\s*"[^"]*"[^{}]*\}/);
      if (argsMatch) {
        try {
          return { name, args: JSON.parse(argsMatch[0]) };
        } catch {}
      }
      return { name, args: {} };
    }

    // Tentativa 5: Busca qualquer nome de tool conhecida no texto + JSON próximo
    for (const tool of knownTools) {
      if (unescaped.includes(tool)) {
        console.log(`[groq] Fallback match (brute force): ${tool}`);
        // Tenta encontrar args JSON após o nome da tool
        const toolIdx = unescaped.indexOf(tool);
        const afterTool = unescaped.slice(toolIdx);
        const argsMatch = afterTool.match(/\(\s*(\{.*?\})\s*\)/s);
        if (argsMatch) {
          try {
            return { name: tool, args: JSON.parse(argsMatch[1]) };
          } catch {}
        }
        // Se é uma tool sem args obrigatórios, retorna vazio
        const noArgTools = ['toggle_mute', 'play_pause_media', 'next_track', 'previous_track', 
                           'lock_screen', 'cancel_shutdown', 'empty_recycle_bin', 'eject_media'];
        if (noArgTools.includes(tool)) {
          return { name: tool, args: {} };
        }
        // Tenta pegar qualquer JSON no texto todo
        const anyJson = unescaped.match(/\{[^{}]*"[^"]+"\s*:\s*"[^"]*"[^{}]*\}/);
        if (anyJson) {
          try {
            return { name: tool, args: JSON.parse(anyJson[0]) };
          } catch {}
        }
        return { name: tool, args: {} };
      }
    }

    console.warn('[groq] Fallback não conseguiu extrair nenhuma tool call do erro.');
    return null;
  } catch (e) {
    console.error('[groq] Falha ao parsear tool call malformada:', e);
    return null;
  }
}

