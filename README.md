# AI Screen Assistant

Assistente web com chat, reconhecimento de voz, síntese de fala e compartilhamento de tela.

## Visão Geral

- **Frontend**: React + TypeScript + Vite (porta 5173)
- **Backend**: Node.js + Express + TypeScript (porta 3001)
- **STT**: Groq Whisper (Speech-to-Text)
- **Chat**: Google Gemini 2.5 Flash (com Function Calling / Tools)
- **Vision**: Google Gemini 2.5 Flash (análise de tela)
- **TTS**: Edge TTS (pt-BR-FranciscaNeural)

---

## Pré-requisitos

- Node.js 18+
- Python 3.x (para Edge TTS)
- Uma chave de API da Groq: https://console.groq.com
- Uma chave de API do Google Gemini: https://aistudio.google.com/apikey

---

## Configuração do Backend

```bash
cd backend
cp .env.example .env
```

Edite o arquivo `.env` e preencha:

```env
# Groq (apenas para STT - Whisper)
GROQ_API_KEY=sua_chave_groq_aqui
GROQ_STT_MODEL=whisper-large-v3-turbo

# Google Gemini (LLM principal - Chat, Vision, Tools)
GEMINI_API_KEY=sua_chave_gemini_aqui
GEMINI_MODEL=gemini-2.0-flash-exp
```

> **Groq (STT)**: https://console.groq.com/docs/models
> - Recomendado: `whisper-large-v3-turbo` (mais rápido)
>
> **Gemini (Chat/Vision)**: https://ai.google.dev/gemini-api/docs/models
> - Recomendado: `gemini-2.0-flash-exp` ou `gemini-2.5-flash`
>
> **Edge TTS**: Instale com `pip install edge-tts`

---

## Instalação e Execução

### Backend

```bash
cd backend
npm install
npm run dev
```

O backend estará disponível em: http://localhost:3001

### Frontend

```bash
cd frontend
npm install
npm run dev
```

O frontend estará disponível em: http://localhost:5173

---

## URLs

| Serviço   | URL                        |
|-----------|----------------------------|
| Frontend  | http://localhost:5173      |
| Backend   | http://localhost:3001      |
| Health    | http://localhost:3001/api/health |

---

## Fluxos de Uso

**Texto**: Digite uma mensagem → clique Enviar → resposta aparece no chat e é lida em voz alta.

**Voz**: Clique "Gravar voz" → fale → clique "Parar gravação" → áudio é transcrito pelo backend → texto entra no chat → resposta é gerada e lida.

**Tela**: Clique "Compartilhar tela" → selecione a janela → assistente confirma. Ao parar, assistente notifica.

---

## Erros Comuns

| Erro | Solução |
|------|---------|
| `GROQ_API_KEY não definida` | Copie `.env.example` para `.env` e preencha a chave Groq |
| `GEMINI_API_KEY não definida` | Adicione sua chave do Google Gemini no `.env` |
| `Permissão de microfone negada` | Permita o acesso ao microfone nas configurações do navegador |
| `MediaRecorder não suportado` | Use Chrome, Edge ou Firefox atualizado |
| `Groq retornou 401` | Verifique se a `GROQ_API_KEY` está correta |
| `Gemini retornou 401` | Verifique se a `GEMINI_API_KEY` está correta |
| `Edge TTS não encontrado` | Instale com `pip install edge-tts` |
| CORS bloqueado | Confirme que `CORS_ORIGIN=http://localhost:5173` no `.env` |

---

## Estrutura

```
ai-screen-assistant/
  frontend/          # React + Vite
  backend/           # Express + TypeScript
    .env.example     # Copie para .env e preencha
```

## Funcionalidades

- ✅ **Chat por voz** com transcrição automática (Groq Whisper)
- ✅ **Respostas inteligentes** com IA (Google Gemini)
- ✅ **Análise de tela** em tempo real (Gemini Vision)
- ✅ **Síntese de voz** natural (Edge TTS)
- ✅ **Function Calling** - Controle do Windows por voz (abrir apps, volume, etc)
- ✅ **Comandos de voz** para ativar/desativar compartilhamento de tela
- ✅ **Detecção de silêncio** inteligente
- ✅ **Filtro de alucinações** do Whisper

## Arquitetura

```
Usuário fala → Groq Whisper (STT) → Gemini (LLM + Tools) → Edge TTS → Áudio
                                           ↓
                                    Gemini Vision (se tela compartilhada)
```
