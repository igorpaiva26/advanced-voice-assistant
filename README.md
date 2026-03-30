# AI Screen Assistant

Assistente web com chat, reconhecimento de voz, síntese de fala e compartilhamento de tela.

## Visão Geral

- **Frontend**: React + TypeScript + Vite (porta 5173)
- **Backend**: Node.js + Express + TypeScript (porta 3001)
- **STT**: Groq Speech-to-Text (via backend)
- **Chat**: Groq Chat Completions (via backend)
- **TTS**: `window.speechSynthesis` do navegador (pt-BR, sem custo)

---

## Pré-requisitos

- Node.js 18+
- Uma chave de API da Groq: https://console.groq.com

---

## Configuração do Backend

```bash
cd backend
cp .env.example .env
```

Edite o arquivo `.env` e preencha:

```env
GROQ_API_KEY=sua_chave_real_aqui
GROQ_CHAT_MODEL=llama3-8b-8192
GROQ_STT_MODEL=whisper-large-v3
```

> Modelos disponíveis na Groq: https://console.groq.com/docs/models
>
> Para chat recomendamos: `llama3-8b-8192` ou `llama-3.1-8b-instant`
>
> Para STT recomendamos: `whisper-large-v3` ou `distil-whisper-large-v3-en`

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
| `GROQ_API_KEY não definida` | Copie `.env.example` para `.env` e preencha a chave |
| `Permissão de microfone negada` | Permita o acesso ao microfone nas configurações do navegador |
| `MediaRecorder não suportado` | Use Chrome, Edge ou Firefox atualizado |
| `Groq retornou 401` | Verifique se a `GROQ_API_KEY` está correta |
| `Groq retornou 429` | Limite de requisições atingido, aguarde alguns segundos |
| CORS bloqueado | Confirme que `CORS_ORIGIN=http://localhost:5173` no `.env` |

---

## Estrutura

```
ai-screen-assistant/
  frontend/          # React + Vite
  backend/           # Express + TypeScript
    .env.example     # Copie para .env e preencha
```

## Trocar de Provider (ex: OpenAI)

Edite apenas `backend/src/services/groq.ts` e as variáveis de ambiente:
- `GROQ_BASE_URL` → URL base do novo provider
- `GROQ_API_KEY` → chave do novo provider
- `GROQ_CHAT_MODEL` / `GROQ_STT_MODEL` → modelos do novo provider

As rotas e o frontend não precisam mudar.
