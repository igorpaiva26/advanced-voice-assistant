# AI Screen Assistant

Assistente de voz inteligente que **EXECUTA AÇÕES** no Windows por comando de voz.

## Visão Geral

- **Frontend**: React + TypeScript + Vite (porta 5173)
- **Backend**: Node.js + Express + TypeScript (porta 3001)
- **Windows Agent**: Node.js (executa ferramentas no Windows)
- **STT**: Groq Whisper (Speech-to-Text)
- **LLM**: Google Gemini 2.5 Flash (com Function Calling)
- **Vision**: Google Gemini 2.5 Flash (análise de tela)
- **TTS**: ElevenLabs (voz natural em português)

---

## Pré-requisitos

- Node.js 18+
- Windows 10/11
- Chave API Groq: https://console.groq.com
- Chave API Google Gemini: https://aistudio.google.com/apikey
- Chave API ElevenLabs: https://elevenlabs.io

---

## Configuração do Backend

```bash
cd backend
cp .env.example .env
```

Edite o arquivo `.env` e preencha:

```env
# Groq (STT - Whisper)
GROQ_API_KEY=sua_chave_groq
GROQ_STT_MODEL=whisper-large-v3-turbo

# Google Gemini (LLM + Vision + Tools)
GEMINI_API_KEY=sua_chave_gemini
GEMINI_MODEL=gemini-2.5-flash

# ElevenLabs (TTS)
ELEVENLABS_API_KEY=sua_chave_elevenlabs
ELEVENLABS_VOICE_ID=cgSgspJ2msm6clMCkdW9
```

---

## Instalação e Execução

### Instalação

```bash
cd backend
npm install

cd ../frontend
npm install

cd ../windows-agent
npm install
```

### Execução Rápida (Windows)

```bash
iniciar.bat
```

Isso inicia automaticamente:
- Backend (http://localhost:3001)
- Frontend (http://localhost:5173)
- Abre o navegador

Para parar:
```bash
parar.bat
```

---

## URLs

| Serviço   | URL                        |
|-----------|----------------------------|
| Frontend  | http://localhost:5173      |
| Backend   | http://localhost:3001      |
| Health    | http://localhost:3001/api/health |

---

## Como Usar

**Comandos de Ação** (assistente EXECUTA):
- "Abre a calculadora"
- "Aumenta o volume para 50"
- "Fecha a quarta aba"
- "Clica nas coordenadas 500, 300"
- "Vai para a próxima aba"
- "Pesquisa sobre IA no Google"

**Perguntas** (assistente RESPONDE):
- "Que horas são?"
- "Como está o tempo?"
- "O que você pode fazer?"

---

## Erros Comuns

| Erro | Solução |
|------|---------|
| `GROQ_API_KEY não definida` | Preencha a chave no `.env` |
| `GEMINI_API_KEY não definida` | Preencha a chave no `.env` |
| `ELEVENLABS_API_KEY não definida` | Preencha a chave no `.env` |
| `Permissão de microfone negada` | Permita nas configurações do navegador |
| `Rate limit atingido` | Aguarde ou reinicie no dia seguinte |
| CORS bloqueado | Confirme `CORS_ORIGIN=http://localhost:5173` no `.env` |

---

## Estrutura

```
ai-screen-assistant/
  backend/           # Express + TypeScript + Gemini
    src/
      agents/        # Perfis de agentes especializados
      services/      # Gemini, Groq, ElevenLabs
      tools/         # Definições e executor de ferramentas
      utils/         # Rate limiter com persistência
    data/            # Histórico do rate limiter
  frontend/          # React + Vite
  windows-agent/     # Executor de ferramentas Windows
  iniciar.bat        # Inicia tudo
  parar.bat          # Para tudo
```

## Funcionalidades

- ✅ **Assistente de AÇÃO** - Executa comandos ao invés de ensinar
- ✅ **40+ ferramentas** - Controle completo do Windows
- ✅ **Análise de tela** em tempo real (Gemini Vision)
- ✅ **Voz natural** (ElevenLabs TTS)
- ✅ **Rate Limiter** com persistência (respeita free tier)
- ✅ **Monitor de uso** da API em tempo real
- ✅ **Novas tools**: mouse_click, browser_switch_tab
- ✅ **Agentes especializados** (social, support, finance, law)

## Arquitetura

```
Usuário fala → Groq Whisper (STT) → Gemini (LLM + Tools) → Windows Agent → Ação executada
                                           ↓                      ↓
                                    Gemini Vision          ElevenLabs TTS
```

## Rate Limiting

O sistema respeita os limites do free tier do Gemini:
- 13 requisições/minuto (margem de segurança)
- 1200 requisições/dia (margem de segurança)
- Persistência em arquivo JSON (mantém histórico entre reinicializações)
- Monitor visual no frontend
- Endpoint de stats: http://localhost:3001/api/stats
