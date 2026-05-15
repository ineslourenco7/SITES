# AI Builder

A Replit/Rocket AI-style platform where you describe an app in chat and a local AI (Ollama) generates the full project with code, file explorer, live preview, and ZIP export. No login, no credits, no payments.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/ai-builder run dev` — run the frontend (port 21157)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + Shadcn/UI
- Editor: Monaco Editor (`@monaco-editor/react`)
- Preview: Sandpack (`@codesandbox/sandpack-react`)
- ZIP export: JSZip
- AI: Ollama local (via Express proxy at `/api/ai/*`)
- Storage: localStorage (no database, no login)
- API: Express 5

## Where things live

- `artifacts/ai-builder/src/pages/landing.tsx` — landing page
- `artifacts/ai-builder/src/pages/builder.tsx` — main IDE workspace
- `artifacts/ai-builder/src/pages/settings.tsx` — Ollama configuration
- `artifacts/ai-builder/src/hooks/use-local-store.ts` — localStorage hooks (projects, settings, chats)
- `artifacts/api-server/src/routes/ai.ts` — Ollama proxy routes
- `lib/api-spec/openapi.yaml` — API contract

## Architecture decisions

- All AI calls proxy through the Express backend to avoid CORS issues with Ollama
- Projects and chat history are fully persisted in localStorage — no server-side storage
- App forces dark mode always (html.dark class set on mount)
- Sandpack re-renders via `key` prop change when Run is clicked or files are updated
- Agent mode uses `/api/ai/generate` (produces files); Manual mode uses `/api/ai/chat` (plain conversation)

## Product

- Landing page with templates grid (7 quick-start templates)
- Full-screen IDE workspace: file explorer + Monaco editor + Sandpack preview + AI chat
- Agent mode: AI generates complete project files from a prompt
- Manual mode: plain conversation with AI
- Fix Errors button: sends current files to AI for error fixing
- Improve Design button: sends current files to AI for UI improvements
- Export ZIP: downloads all project files as a zip
- Settings page: configure Ollama endpoint and model
- Projects saved in localStorage — switch between multiple projects

## User preferences

- Stack is React+Vite (not Next.js — adapted for the monorepo environment)
- Always dark mode, no light mode toggle
- No login, no credits, no payments

## Gotchas

- Ollama must be running locally at `http://localhost:11434`
- Set `OLLAMA_ORIGINS="*"` on Ollama if accessing from browser directly
- The proxy handles CORS — frontend calls `/api/ai/*`, backend proxies to Ollama
- After each OpenAPI spec change, re-run codegen before using the updated types

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
