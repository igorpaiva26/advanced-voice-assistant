export interface Env {
  PORT: number;
  GROQ_API_KEY: string;
  GROQ_BASE_URL: string;
  GROQ_CHAT_MODEL: string;
  GROQ_STT_MODEL: string;
  GROQ_TIMEOUT_MS: number;
  CORS_ORIGIN: string;
  ELEVENLABS_API_KEY: string;
  ELEVENLABS_VOICE_ID: string;
  ELEVENLABS_MODEL: string;
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
}

let _env: Env | null = null;

export function loadEnv(): Env {
  if (_env) return _env;

  const required = ['GROQ_API_KEY', 'GROQ_CHAT_MODEL', 'GROQ_STT_MODEL', 'ELEVENLABS_API_KEY'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`\n❌ Variáveis de ambiente obrigatórias não definidas: ${missing.join(', ')}`);
    console.error('👉 Copie backend/.env.example para backend/.env e preencha os valores.\n');
    process.exit(1);
  }

  _env = {
    PORT: parseInt(process.env.PORT ?? '3001', 10),
    GROQ_API_KEY: process.env.GROQ_API_KEY!,
    GROQ_BASE_URL: process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1',
    GROQ_CHAT_MODEL: process.env.GROQ_CHAT_MODEL!,
    GROQ_STT_MODEL: process.env.GROQ_STT_MODEL!,
    GROQ_TIMEOUT_MS: parseInt(process.env.GROQ_TIMEOUT_MS ?? '30000', 10),
    CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY!,
    ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID ?? 'cgSgspJ2msm6clMCkdW9',
    ELEVENLABS_MODEL: process.env.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? '',
    GEMINI_MODEL: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
  };

  return _env;
}
