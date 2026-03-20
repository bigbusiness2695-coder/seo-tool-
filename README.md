# Originality Platform

Advanced plagiarism checker + AI text humanizer with a unified dashboard.

## Features Implemented

- Deep source matching across curated source categories (Wikipedia, academic, news, competitor, social).
- Exact + paraphrase + partial similarity detection with color-coded in-text highlights.
- AI-generated content probability and AI pattern detector.
- Source credibility labels and citation suggestions (MLA/APA/Chicago).
- Humanizer with tone customization, style preservation (protected phrases), grammar fix, vocabulary enhancement.
- 5-version humanization generator with quality scoring.
- One-click optimization workflow (check -> detect AI -> humanize -> score).
- Real-time analysis while typing.
- Batch plagiarism checker with CSV export.
- Document-to-document comparison tool.
- Timeline chart and usage statistics.
- Export to PDF, DOCX, TXT, MD, and Google Docs stub link.
- Dark/light theme support and accessibility-friendly controls.

## Quick Start

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open: `http://localhost:8000`

## API Highlights

- `POST /api/plagiarism/check`
- `POST /api/plagiarism/batch`
- `POST /api/plagiarism/compare`
- `POST /api/humanize`
- `POST /api/optimize`
- `POST /api/realtime/analyze`
- `GET /api/history/stats`
- `GET /api/history/timeline`
- `POST /api/export`
