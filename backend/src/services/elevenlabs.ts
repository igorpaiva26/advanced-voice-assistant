/**
 * Serviço de TTS via ElevenLabs.
 * Para trocar de provider, substitua este arquivo mantendo a mesma assinatura:
 *   synthesizeSpeech(text: string): Promise<Buffer>
 */

import fetch from 'node-fetch';
import { loadEnv } from '../types/env';

const env = loadEnv();

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  console.log(`[elevenlabs] Sintetizando: "${text.slice(0, 60)}..."`);

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${env.ELEVENLABS_VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: env.ELEVENLABS_MODEL,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`[elevenlabs] Erro: ${res.status} ${err}`);
    throw new Error(`ElevenLabs retornou ${res.status}: ${err}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  console.log(`[elevenlabs] Áudio gerado: ${buffer.length} bytes`);
  return buffer;
}
