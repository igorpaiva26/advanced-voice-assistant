import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { loadEnv } from './types/env';
import audioRouter from './routes/audio';
import audiovisionRouter from './routes/audiovision';
import chatRouter from './routes/chat';
import transcribeRouter from './routes/transcribe';
import ttsRouter from './routes/tts';
import visionRouter from './routes/vision';

const env = loadEnv();
const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/audio', audioRouter);
app.use('/api/audiovision', audiovisionRouter);
app.use('/api/chat', chatRouter);
app.use('/api/transcribe', transcribeRouter);
app.use('/api/tts', ttsRouter);
app.use('/api/vision', visionRouter);

app.listen(env.PORT, () => {
  console.log(`\n✅ Backend rodando em http://localhost:${env.PORT}`);
  console.log(`   CORS liberado para: ${env.CORS_ORIGIN}`);
  console.log(`   Modelo de chat: ${env.GROQ_CHAT_MODEL}`);
  console.log(`   Modelo de STT:  ${env.GROQ_STT_MODEL}\n`);
});
