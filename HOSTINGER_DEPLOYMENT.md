# Hostinger Deployment Guide

This project is split into:

- `frontend/` (React + Vite)
- `backend/` (Node.js + Express API)

## 1) Backend deployment (Hostinger Node app)

1. In Hostinger hPanel/cPanel, open **Node.js** manager.
2. Create app:
   - App root: `.../plagiarism-tool/backend`
   - Startup file: `server.js`
   - Node version: latest available
3. Upload `backend/` files.
4. Run install in terminal:
   - `cd ~/plagiarism-tool/backend`
   - `npm install`
5. Configure environment variables:
   - `PORT=3001`
   - `FRONTEND_URL=https://yourdomain.com`
   - `PLAGSCAN_API_KEY=...` (optional, fallback exists)
   - `PLAGSCAN_API_URL=https://api.plagscan.com/v1/plagiarism/check`
   - `OLLAMA_URL=http://localhost:11434`
   - `OLLAMA_MODEL=mistral`
6. Start/restart app.

## 2) Frontend deployment (Hostinger static hosting)

1. Build frontend locally:
   - `cd frontend`
   - `npm install`
   - `npm run build`
2. Upload `frontend/dist/*` contents to:
   - `public_html/plagiarism-tool/`
3. Add `.htaccess` to support SPA routing:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /plagiarism-tool/
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /plagiarism-tool/index.html [L]
</IfModule>
```

4. In frontend build env, set:
   - `VITE_API_BASE_URL=https://yourdomain.com/api`

## 3) Ollama notes

- If Hostinger plan supports SSH/processes:
  - install Ollama
  - run `ollama pull mistral`
  - keep Ollama service active
- If not available, backend still works with built-in humanizer fallback.

## 4) Verify

- `GET https://yourdomain.com/api/health`
- Open frontend URL and test:
  - plagiarism check
  - humanize text
  - SEO analyze
