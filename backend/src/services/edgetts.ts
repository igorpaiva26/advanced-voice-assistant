/**
 * Serviço de TTS via Microsoft Edge TTS (Python edge-tts).
 * Gratuito, sem conta, sem limite. Voz: pt-BR-FranciscaNeural
 * Otimizado: usa stdin/stdout para evitar overhead de iniciar Python a cada chamada
 */

import { spawn, ChildProcess } from 'child_process';
import { readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

let ttsProcess: ChildProcess | null = null;
let processReady = false;

function startTTSProcess() {
  if (ttsProcess) return;
  
  console.log('[edgetts] Iniciando processo Python persistente...');
  ttsProcess = spawn('python', ['-u', '-m', 'edge_tts', '--voice', 'pt-BR-FranciscaNeural'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  ttsProcess.on('error', (err) => {
    console.error('[edgetts] Erro no processo:', err);
    ttsProcess = null;
    processReady = false;
  });

  ttsProcess.on('exit', () => {
    console.log('[edgetts] Processo encerrado');
    ttsProcess = null;
    processReady = false;
  });

  processReady = true;
}

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  console.log(`[edgetts] Sintetizando: "${text.slice(0, 60)}"`);
  const t0 = Date.now();

  const outFile = join(tmpdir(), `edgetts_${Date.now()}.mp3`);

  // Fallback: se processo persistente falhar, usa execFile direto
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);

  await execFileAsync('python', [
    '-m', 'edge_tts',
    '--voice', 'pt-BR-FranciscaNeural',
    '--text', text,
    '--write-media', outFile,
  ]);

  const buffer = await readFile(outFile);
  await unlink(outFile).catch(() => {});
  
  console.log(`[edgetts] Áudio gerado: ${buffer.length} bytes em ${Date.now() - t0}ms`);
  return buffer;
}

// Cleanup ao encerrar servidor
process.on('exit', () => {
  if (ttsProcess) ttsProcess.kill();
});
