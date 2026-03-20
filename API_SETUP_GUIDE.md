# API Setup Guide (Core + Enhanced + Optional)

This codebase is wired for a multi-provider architecture.

## Core providers to configure first

1. **Ollama** (humanizer)
   - Install: https://ollama.ai
   - Pull model: `ollama pull mistral`
   - Env:
     - `OLLAMA_URL=http://localhost:11434`
     - `OLLAMA_MODEL=mistral`

2. **PlagScan** (plagiarism)
   - Env:
     - `PLAGSCAN_API_KEY=`
     - `PLAGSCAN_API_SECRET=`
     - `PLAGSCAN_API_URL=`

3. **LanguageTool** (grammar)
   - Env:
     - `LANGUAGETOOL_URL=https://api.languagetool.org/v2`

4. **Google Custom Search** (SEO enrichment)
   - Env:
     - `GOOGLE_SEARCH_API_KEY=`
     - `GOOGLE_SEARCH_ENGINE_ID=`

## Enhanced providers

- `COHERE_API_KEY`
- `HUGGINGFACE_API_KEY`, `HUGGINGFACE_MODEL`
- `OPENAI_API_KEY`
- `CLAUDE_API_KEY`
- `NEWSAPI_KEY`
- `MONGODB_URI`
- `SENDGRID_API_KEY`

## Optional provider packs

### Plagiarism alternatives
- `COPYSCAPE_USERNAME`, `COPYSCAPE_API_KEY`
- `TURNITIN_API_KEY`, `TURNITIN_API_SECRET`
- `QUETEXT_API_KEY`
- `UNICHECK_CLIENT_ID`, `UNICHECK_CLIENT_SECRET`

### SEO / Search / Performance
- `MOZ_ACCESS_ID`, `MOZ_SECRET_KEY`
- `SEMRUSH_API_KEY`
- `GOOGLE_SEARCH_CONSOLE_CREDENTIALS`
- `AHREFS_API_KEY`
- `GTMETRIX_API_KEY`

### Content / Language / NLP
- `WIKIPEDIA_API_URL`, `WIKTIONARY_API_URL`
- `DATAMUSE_API_URL`
- `WORDNIK_API_KEY`
- `MERRIAM_WEBSTER_API_KEY`
- `GOOGLE_NLP_KEY_FILE`
- `AZURE_LANGUAGE_KEY`, `AZURE_LANGUAGE_ENDPOINT`
- `TEXTRAZOR_API_KEY`

### Data / Storage / Utility / Auth
- `RAPIDAPI_KEY`
- `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_DATABASE_URL`
- `SUPABASE_URL`, `SUPABASE_KEY`
- `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`
- `IP_API_URL`
- `TIMEZONEDB_API_KEY`
- `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`

## Runtime inspection endpoints

- `GET /api/integrations/status`  
  Returns configured/missing keys per provider category.
- `GET /api/integrations/env-template`  
  Returns a generated env template text payload.

## Note

Provider availability, limits, and free-tier terms may change by vendor. Verify each provider’s current pricing/policy in their official docs before production use.
