# Model Switcher Interface

An AI chat interface that lets you switch between multiple free models mid-project, built as part of the Numbase Project 1 internship challenge.

## Features

- **Three free AI models** via OpenRouter, each with its own identity — accent color, icon, and animated aurora background: **MiniMax M3** (MiniMax), **Nemotron** (NVIDIA), **Laguna** (Poolside).
- **Streaming responses** — replies appear token by token instead of all at once.
- **Markdown rendering** with syntax-highlighted code blocks (copy-to-clipboard on both the whole reply and individual code blocks).
- **Persistent conversation history** — conversations are saved to `localStorage`, with automatic context-aware titles, manual rename, delete, search, and filter-by-model.
- **Regenerate** a reply, or **retry** after an error.
- **Optional web search** — models can search the web for current information when a question needs it (see [Web search](#web-search) below).
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

2. Configure the backend's API keys:

   ```bash
   cp server/.env.example server/.env
   # then edit server/.env and set OPENROUTER_API_KEY (required)
   # and YOU_API_KEY (optional -- enables web search; see "Web search" below)
   ```

3. Run the backend and frontend (in two terminals):

   ```bash
   cd server && npm run dev   # http://localhost:3000
   npm run dev                # http://localhost:5173
   ```

   The frontend dev server proxies `/api/*` requests to the backend, so these keys only ever need to exist in `server/.env` — never in the frontend.

4. Open `http://localhost:5173`, pick a model, and start chatting.

## Web search

Models can optionally search the web when a question needs current or up-to-date information (e.g. "what are the latest iPhone releases?"). For general or timeless questions (e.g. "explain photosynthesis"), models answer directly without searching — the model itself decides when a search is needed.

- **Provider:** [You.com](https://you.com/)'s Web Search API. Requires a `YOU_API_KEY` — get one at [you.com/platform](https://you.com/platform) and place it in `server/.env` (never in the frontend). Without it, models simply answer without searching.
- **Server-side only:** search runs entirely in the backend, as a `web_search` tool the model can call through OpenRouter's tool-calling API. The frontend never talks to You.com directly, and `YOU_API_KEY` never leaves the backend.
- **Sources:** when a reply uses search results, the model is instructed to say so and cite source URLs as Markdown links, which the existing chat UI already renders.
- **Reliability:** a search failure, timeout, or empty result set never breaks the chat — the model falls back to answering from its own knowledge and says that current information couldn't be verified. Up to 3 rounds of tool calls are allowed per reply before a final answer is forced, so a reply can never loop indefinitely.

To test it: ask something like "What are the latest iPhone releases?" or "Who won the last World Cup?" and watch for the brief "Searching the web..." indicator before the reply streams in.

## Run with Docker

An alternative to the manual setup above — runs the whole app (frontend + backend) in two containers, no local Node install required.

**Prerequisites:** [Docker](https://www.docker.com/) with Compose (Docker Desktop includes both).

1. Add your API keys (same file the manual setup uses):

   ```bash
   cp server/.env.example server/.env
   # then edit server/.env and set OPENROUTER_API_KEY (required)
   # and YOU_API_KEY (optional -- enables web search)
   ```

2. Build and start both containers:

   ```bash
   docker compose up --build
   ```

3. Open **http://localhost:8080**.

4. Stop the app with `Ctrl+C`, or `docker compose down` if it's running in the background.

The API key is only ever read from `server/.env` at container start — it's never baked into an image or committed to the repo.

### Other scripts

| Command (root) | Command (`server/`) | Does |
|---|---|---|
| `npm run build` | `npm run build` | Typecheck + production build |
| `npm run lint` | — | Lint the frontend |
| — | `npm run typecheck` | Typecheck the backend without emitting |
| — | `npm test` | Run the backend test suite (DuckDuckGo/OpenRouter calls mocked) |
| `npm run preview` | `npm start` | Preview/run the production build |
