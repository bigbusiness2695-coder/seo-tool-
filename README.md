# Free Plagiarism Checker + Humanizer + SEO Optimizer

Production-style starter with:

- **React frontend** (`frontend/`)
- **Node.js + Express backend** (`backend/`)
- PlagScan integration (with safe local fallback)
- Ollama integration for free local humanization (with safe fallback)
- Integrated SEO analysis module

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

### 2) Text Humanizer
- Humanization intensity slider (0-100)
- Ollama integration (`mistral` by default)
- 5 generated versions
- Side-by-side original vs humanized comparison
- Copy + download as `.txt`
- Graceful fallback if Ollama is unavailable

### 3) SEO Content Optimizer
- SEO score (0-100) + breakdown
- Keyword analyzer + density
- Headline optimizer suggestions
- Meta description generator
- Content gap + link + visual suggestions
- Search intent and schema suggestions
- Optimization action plan

### 4) Combined Workflow
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
PLAGSCAN_API_KEY=
PLAGSCAN_API_URL=https://api.plagscan.com/v1/plagiarism/check
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=mistral
```

> If `PLAGSCAN_API_KEY` is missing, backend uses a local heuristic plagiarism analyzer fallback.

## API Endpoints

- `GET /api/health`
- `POST /api/plagiarism`
- `POST /api/humanize`
- `POST /api/seo/analyze`
- `POST /api/optimize`

## Deployment

- Hostinger guide: `HOSTINGER_DEPLOYMENT.md`
