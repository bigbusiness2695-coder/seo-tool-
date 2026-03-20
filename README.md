# Free Plagiarism Checker + Humanizer + SEO Optimizer

Production-style starter with:

- **React frontend** (`frontend/`)
- **Node.js + Express backend** (`backend/`)
- PlagScan integration (with safe local fallback)
- Ollama integration for free local humanization (with safe fallback)
- Integrated SEO analysis module
- Multi-provider API integration registry (37-provider ready env map)

## Features

### 1) Plagiarism Checker
- Unlimited text input
- Character counter (`0/∞`)
- Plagiarism percentage + progress bar
- Risk status (Low / Medium / High)
- Match list with source/credibility/match type
- Color thresholds:
  - `0-10%` green
  - `10-30%` yellow
  - `30%+` red
- Copy/download report
- Provider chain support: PlagScan -> Copyscape -> Turnitin -> Quetext -> Unicheck -> local fallback

### 2) Text Humanizer
- Humanization intensity slider (0-100)
- Ollama integration (`mistral` by default)
- 5 generated versions
- Side-by-side original vs humanized comparison
- Copy + download as `.txt`
- Graceful fallback if Ollama is unavailable
- Provider chain support: Ollama -> Cohere -> HuggingFace -> OpenAI -> Claude -> local fallback

### 3) SEO Content Optimizer
- SEO score (0-100) + breakdown
- Keyword analyzer + density
- Headline optimizer suggestions
- Meta description generator
- Content gap + link + visual suggestions
- Search intent and schema suggestions
- Optimization action plan
- Optional external enrichment: Google Custom Search + NewsAPI + Datamuse semantic keywords

### 4) Grammar Checker
- LanguageTool integration endpoint
- Returns score + issue list + suggestions
- Local fallback checks if external grammar service is unavailable

### 5) Combined Workflow
- One-click `/api/optimize` pipeline:
  - plagiarism check
  - humanization
  - SEO analysis
  - combined quality score

## Project Structure

```text
backend/
  lib/
    plagiarism.js
    humanize.js
    grammar.js
    integrations.js
    seo.js
  server.js
  .env.example
frontend/
  src/
    App.jsx
    main.jsx
    styles.css
  vite.config.js
```

## Local Setup

### Backend
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```
Backend runs on `http://localhost:3001`

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173`

Set frontend API base if needed:
```bash
VITE_API_BASE_URL=http://localhost:3001
```

## Environment Variables

Backend `.env`:

```bash
PORT=3001
FRONTEND_URL=http://localhost:5173
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=mistral
```

Use `backend/.env.example` for the full 37-provider template.

> Important: This project supports provider integration in code, but API keys/accounts must be created by you. The backend automatically falls back when a provider is not configured or unavailable.

## API Endpoints

- `GET /api/health`
- `GET /api/integrations/status`
- `GET /api/integrations/env-template`
- `POST /api/plagiarism`
- `POST /api/humanize`
- `POST /api/grammar/check`
- `POST /api/seo/analyze`
- `POST /api/optimize`

## Deployment

- Hostinger guide: `HOSTINGER_DEPLOYMENT.md`
