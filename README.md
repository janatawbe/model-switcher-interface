# Model Switcher Interface

An AI chat interface that lets you switch between multiple free models mid-project, built as part of the Numbase Project 1 internship challenge.

## Features

- **Three free AI models** via OpenRouter, each with its own identity — accent color, icon, and animated aurora background: **MiniMax M3** (MiniMax), **Nemotron** (NVIDIA), **Laguna** (Poolside).
- **Streaming responses** — replies appear token by token instead of all at once.
- **Markdown rendering** with syntax-highlighted code blocks (copy-to-clipboard on both the whole reply and individual code blocks).
- **Persistent conversation history** — conversations are saved to `localStorage`, with automatic context-aware titles, manual rename, delete, search, and filter-by-model.
- **Regenerate** a reply, or **retry** after an error.
- **Responsive** across mobile, tablet, laptop, and desktop, with an off-canvas sidebar on small screens.
- Honest, model-aware error messages (rate limits, provider outages, etc.) instead of raw API errors.

## Stack

- React 19, TypeScript, Vite, Tailwind CSS v4, Motion
- Node.js, Express
- OpenRouter (the sole AI gateway)

## Architecture

```
React frontend  →  Express backend  →  OpenRouter  →  selected AI model
```

The frontend never talks to OpenRouter directly and never sees the API key. It only ever calls this project's own backend (`/api/chat`, `/api/title`), which holds the OpenRouter API key server-side, resolves the app's model IDs (`minimax-m3` / `nemotron` / `laguna`) to real OpenRouter model IDs, and streams the response back.

## Project layout

```
src/               Frontend (Vite + React)
  components/       UI, layout, and chat components
  lib/storage.ts     localStorage persistence
  types/             Shared frontend types
server/            Backend (Express)
  src/routes/         /api/chat, /api/title, /api/health
  src/services/        OpenRouter integration (the only file that calls OpenRouter)
  src/config/models.ts App model ID → OpenRouter model ID registry
```

## Getting started

Requires Node.js and an [OpenRouter](https://openrouter.ai/) API key (a free account is enough — all three models are on OpenRouter's free tier).

1. Install dependencies for both the frontend and backend:

   ```bash
   npm install
   cd server && npm install && cd ..
   ```

2. Configure the backend's API key:

   ```bash
   cp server/.env.example server/.env
   # then edit server/.env and set OPENROUTER_API_KEY
   ```

3. Run the backend and frontend (in two terminals):

   ```bash
   cd server && npm run dev   # http://localhost:3000
   npm run dev                # http://localhost:5173
   ```

   The frontend dev server proxies `/api/*` requests to the backend, so `OPENROUTER_API_KEY` only ever needs to exist in `server/.env` — never in the frontend.

4. Open `http://localhost:5173`, pick a model, and start chatting.

### Other scripts

| Command (root) | Command (`server/`) | Does |
|---|---|---|
| `npm run build` | `npm run build` | Typecheck + production build |
| `npm run lint` | — | Lint the frontend |
| — | `npm run typecheck` | Typecheck the backend without emitting |
| `npm run preview` | `npm start` | Preview/run the production build |
