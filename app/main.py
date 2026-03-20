import csv
import datetime as dt
import io
import math
import os
import random
import re
import sqlite3
import statistics
import uuid
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from typing import Any

from docx import Document
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
STATIC_DIR = os.path.join(BASE_DIR, "static")
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "app.db")
os.makedirs(DATA_DIR, exist_ok=True)

app = FastAPI(
    title="Originality Platform API",
    description="Advanced plagiarism checker + text humanizer",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class SourceRecord(BaseModel):
    source_id: str
    title: str
    source_type: str
    url: str
    author: str
    year: int
    credibility: str
    text: str


SOURCE_CORPUS: list[SourceRecord] = [
    SourceRecord(
        source_id="wiki-climate",
        title="Climate change overview",
        source_type="wikipedia",
        url="https://en.wikipedia.org/wiki/Climate_change",
        author="Wikipedia Contributors",
        year=2024,
        credibility="trusted",
        text=(
            "Climate change includes both global warming driven by human-induced emissions "
            "of greenhouse gases and the resulting large-scale shifts in weather patterns. "
            "Although there have been previous periods of climatic change, the current "
            "changes are rapid and primarily caused by human activities."
        ),
    ),
    SourceRecord(
        source_id="academic-learning",
        title="Learning Analytics in Digital Education",
        source_type="academic_journal",
        url="https://example.edu/journal/learning-analytics",
        author="A. Morgan",
        year=2023,
        credibility="trusted",
        text=(
            "Learning analytics allows institutions to model student performance using "
            "historical interaction data. Ethical use requires transparency, data minimization, "
            "and explicit consent from learners."
        ),
    ),
    SourceRecord(
        source_id="news-ai",
        title="AI adoption reshapes workplaces",
        source_type="news_article",
        url="https://example-news.com/ai-workplaces",
        author="L. Reed",
        year=2025,
        credibility="trusted",
        text=(
            "Companies are integrating AI copilots to draft emails, summarize meetings, and "
            "assist support teams. Analysts warn that success depends on governance, training, "
            "and clear accountability."
        ),
    ),
    SourceRecord(
        source_id="competitor-seo",
        title="Top SEO writing strategies",
        source_type="competitor_website",
        url="https://competitor-content.com/seo-strategies",
        author="Growth Desk",
        year=2024,
        credibility="medium",
        text=(
            "High-ranking articles generally satisfy search intent, use structured headings, "
            "and answer user questions quickly. Keyword stuffing hurts readability and trust."
        ),
    ),
    SourceRecord(
        source_id="social-media-growth",
        title="Thread on audience growth",
        source_type="social_media_post",
        url="https://social.example/thread/8921",
        author="Creator Daily",
        year=2025,
        credibility="untrusted",
        text=(
            "Consistency beats virality. Publish useful insights weekly, repurpose top posts, "
            "and engage with comments to build durable audience trust."
        ),
    ),
]

CREDIBILITY_LABEL = {
    "trusted": "✓ Trusted",
    "medium": "⚠️ Medium",
    "untrusted": "✗ Untrusted",
}

STOP_WORDS = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "of",
    "for",
    "is",
    "are",
    "was",
    "were",
    "be",
    "in",
    "on",
    "with",
    "that",
    "this",
    "as",
    "by",
    "it",
    "from",
    "at",
}

SYNONYM_MAP = {
    "big": ["large", "substantial", "major"],
    "small": ["compact", "minor", "tiny"],
    "good": ["excellent", "solid", "strong"],
    "bad": ["poor", "weak", "suboptimal"],
    "important": ["critical", "vital", "essential"],
    "show": ["demonstrate", "reveal", "indicate"],
    "help": ["assist", "support", "enable"],
    "use": ["utilize", "apply", "leverage"],
    "make": ["create", "build", "produce"],
    "improve": ["enhance", "refine", "strengthen"],
}

GENERIC_TRANSITIONS = [
    "furthermore",
    "moreover",
    "in conclusion",
    "additionally",
    "therefore",
    "thus",
    "however",
]

TONE_OPENERS = {
    "professional": ["In practice,", "From a strategic standpoint,", "Notably,"],
    "casual": ["Honestly,", "Here's the thing:", "In simple terms,"],
    "academic": ["From an empirical perspective,", "The evidence suggests that", "In this context,"],
    "creative": ["Imagine this:", "Picture the moment when", "Here's a vivid way to see it:"],
    "sarcastic": ["Sure, because that always works,", "Naturally,", "Obviously, in a perfect world,"],
    "technical": ["At the implementation layer,", "Operationally,", "From a systems angle,"],
}

LEVEL_PRESETS = {
    20: "Light Touch",
    40: "Moderate",
    60: "Medium",
    80: "Aggressive",
    100: "Complete Rewrite",
}


class TextRequest(BaseModel):
    text: str = Field(min_length=5)
    title: str | None = None
    document_id: str | None = None


class HumanizeRequest(TextRequest):
    tone: str = Field(default="professional")
    level: int = Field(default=60, ge=20, le=100)
    versions: int = Field(default=5, ge=1, le=5)
    protect_phrases: list[str] = Field(default_factory=list)


class BatchDocument(BaseModel):
    document_id: str | None = None
    title: str | None = None
    text: str = Field(min_length=5)


class BatchRequest(BaseModel):
    documents: list[BatchDocument] = Field(min_length=1, max_length=20)
    email: str | None = None


class CompareRequest(BaseModel):
    left_text: str = Field(min_length=5)
    right_text: str = Field(min_length=5)


class ExportRequest(BaseModel):
    export_format: str = Field(pattern="^(pdf|docx|txt|md|google_docs)$")
    filename: str = "report"
    report: dict[str, Any]
    humanized_text: str | None = None


class OptimizeRequest(BaseModel):
    text: str = Field(min_length=5)
    tone: str = "professional"
    level: int = Field(default=60, ge=20, le=100)
    protect_phrases: list[str] = Field(default_factory=list)


def db_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = db_conn()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS analyses (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            label TEXT NOT NULL,
            words INTEGER NOT NULL,
            exact REAL NOT NULL,
            paraphrased REAL NOT NULL,
            partial REAL NOT NULL,
            original REAL NOT NULL,
            ai_probability REAL NOT NULL,
            readability REAL NOT NULL,
            quality_score REAL NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


@app.on_event("startup")
def startup_event() -> None:
    init_db()


def tokenize(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z']+", text.lower())


def normalized_tokens(text: str) -> list[str]:
    out: list[str] = []
    for tok in tokenize(text):
        if tok in STOP_WORDS:
            continue
        mapped = tok
        for root, variants in SYNONYM_MAP.items():
            if tok == root or tok in variants:
                mapped = root
                break
        out.append(mapped)
    return out


def split_sentences_with_offsets(text: str) -> list[dict[str, Any]]:
    segments: list[dict[str, Any]] = []
    for match in re.finditer(r"[^.!?\n]+[.!?]?", text):
        sentence = match.group(0).strip()
        if sentence:
            segments.append(
                {"sentence": sentence, "start": match.start(), "end": match.end()}
            )
    return segments


def sentence_similarity(a: str, b: str) -> float:
    a_set = set(normalized_tokens(a))
    b_set = set(normalized_tokens(b))
    if not a_set or not b_set:
        return 0.0
    jac = len(a_set & b_set) / len(a_set | b_set)
    seq = SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()
    return 0.65 * jac + 0.35 * seq


def detect_exact_match(a: str, b: str) -> bool:
    a_clean = re.sub(r"\s+", " ", a.lower()).strip()
    b_clean = re.sub(r"\s+", " ", b.lower()).strip()
    return a_clean == b_clean or (
        len(a_clean) > 35 and SequenceMatcher(None, a_clean, b_clean).ratio() > 0.96
    )


def source_sentences() -> list[dict[str, Any]]:
    cached: list[dict[str, Any]] = []
    for src in SOURCE_CORPUS:
        for seg in split_sentences_with_offsets(src.text):
            cached.append({"source": src, "sentence": seg["sentence"]})
    return cached


def credibility_points(label: str) -> int:
    return {"trusted": 100, "medium": 60, "untrusted": 30}.get(label, 50)


def format_citation(src: SourceRecord, style: str) -> str:
    access_date = dt.date.today().isoformat()
    if style == "MLA":
        return f'{src.author}. "{src.title}." {src.source_type}, {src.year}, {src.url}. Accessed {access_date}.'
    if style == "APA":
        return f"{src.author} ({src.year}). {src.title}. {src.url}"
    return f'{src.author}. "{src.title}." {src.source_type} ({src.year}). {src.url}.'


def suggest_citations(sources: list[SourceRecord]) -> list[dict[str, Any]]:
    citations: list[dict[str, Any]] = []
    seen: set[str] = set()
    for src in sources:
        if src.source_id in seen:
            continue
        seen.add(src.source_id)
        citations.append(
            {
                "source_id": src.source_id,
                "title": src.title,
                "mla": format_citation(src, "MLA"),
                "apa": format_citation(src, "APA"),
                "chicago": format_citation(src, "Chicago"),
            }
        )
    return citations


def count_syllables(word: str) -> int:
    word = re.sub(r"[^a-z]", "", word.lower())
    if not word:
        return 1
    groups = re.findall(r"[aeiouy]+", word)
    count = len(groups)
    if word.endswith("e") and count > 1:
        count -= 1
    return max(count, 1)


def readability_metrics(text: str) -> dict[str, float]:
    words = tokenize(text)
    sentences = split_sentences_with_offsets(text)
    word_count = max(len(words), 1)
    sentence_count = max(len(sentences), 1)
    syllables = sum(count_syllables(w) for w in words) or 1
    avg_sentence_len = word_count / sentence_count
    avg_word_len = sum(len(w) for w in words) / word_count
    flesch = 206.835 - 1.015 * avg_sentence_len - 84.6 * (syllables / word_count)
    grade = 0.39 * avg_sentence_len + 11.8 * (syllables / word_count) - 15.59
    return {
        "flesch": round(max(min(flesch, 100), 0), 2),
        "grade_level": round(max(grade, 0), 2),
        "avg_sentence_length": round(avg_sentence_len, 2),
        "avg_word_length": round(avg_word_len, 2),
    }


def readability_tips(metrics: dict[str, float]) -> list[str]:
    tips: list[str] = []
    if metrics["avg_sentence_length"] > 24:
        tips.append("Shorten long sentences to improve clarity and pacing.")
    if metrics["avg_word_length"] > 5.2:
        tips.append("Use simpler word choices where precision is not required.")
    if metrics["flesch"] < 55:
        tips.append("Add transitions and shorter paragraphs for better readability.")
    if not tips:
        tips.append("Readability looks good. Keep sentence variety for engagement.")
    return tips


def detect_ai_patterns(text: str) -> dict[str, Any]:
    lowered = text.lower()
    tokens = tokenize(lowered)
    sentences = split_sentences_with_offsets(text)
    sentence_lengths = [len(tokenize(s["sentence"])) for s in sentences] or [1]
    transition_hits = [t for t in GENERIC_TRANSITIONS if t in lowered]
    contraction_count = len(re.findall(r"\b\w+'\w+\b", text))
    repetitive_bigrams = Counter(
        zip(tokens, tokens[1:])
    )
    repeated = [k for k, v in repetitive_bigrams.items() if v >= 3]
    variance = statistics.pvariance(sentence_lengths) if len(sentence_lengths) > 1 else 0

    patterns: list[str] = []
    if transition_hits:
        patterns.append("Frequent generic transitions often seen in AI text.")
    if variance < 8:
        patterns.append("Low sentence-length variance suggests formulaic structure.")
    if contraction_count == 0 and len(tokens) > 80:
        patterns.append("Very formal style with no contractions.")
    if repeated:
        patterns.append("Repetitive phrase patterns detected.")

    score = 10
    score += min(len(transition_hits) * 10, 30)
    score += 25 if variance < 8 else 0
    score += 15 if contraction_count == 0 and len(tokens) > 80 else 0
    score += 10 if repeated else 0
    score = round(min(score, 100), 2)

    return {
        "ai_generated_probability": score,
        "patterns": patterns or ["No strong AI-signature patterns detected."],
        "signals": {
            "generic_transition_count": len(transition_hits),
            "sentence_length_variance": round(variance, 2),
            "repetitive_bigram_patterns": len(repeated),
            "overly_formal_language": contraction_count == 0 and len(tokens) > 80,
        },
    }


def grammar_score(text: str) -> float:
    errors = 0
    if re.search(r"\s{2,}", text):
        errors += 1
    if re.search(r"[a-z][A-Z]", text):
        errors += 1
    if re.search(r"[!?]{3,}", text):
        errors += 1
    if len(text) > 0 and text[-1] not in ".!?":
        errors += 1
    return round(max(100 - errors * 15, 40), 2)


def content_quality_score(
    originality: float, humanness: float, readability: float, grammar: float
) -> dict[str, Any]:
    score = (
        originality * 0.35
        + humanness * 0.3
        + readability * 0.2
        + grammar * 0.15
    )
    return {
        "overall": round(score, 2),
        "breakdown": {
            "originality": round(originality, 2),
            "humanness": round(humanness, 2),
            "readability": round(readability, 2),
            "grammar": round(grammar, 2),
        },
    }


def plagiarism_report(text: str) -> dict[str, Any]:
    sentence_nodes = split_sentences_with_offsets(text)
    if not sentence_nodes:
        raise HTTPException(status_code=400, detail="Input text is empty.")
    source_nodes = source_sentences()

    words_total = max(len(tokenize(text)), 1)
    counters = {"exact": 0, "paraphrased": 0, "partial": 0}
    segments: list[dict[str, Any]] = []
    matched_source_map: dict[str, dict[str, Any]] = {}

    for node in sentence_nodes:
        sentence = node["sentence"]
        sentence_words = max(len(tokenize(sentence)), 1)
        best: dict[str, Any] | None = None
        for src_node in source_nodes:
            src_sentence = src_node["sentence"]
            src = src_node["source"]
            label = None
            confidence = 0.0
            if detect_exact_match(sentence, src_sentence):
                label = "exact"
                confidence = 1.0
            else:
                sim = sentence_similarity(sentence, src_sentence)
                if sim >= 0.79:
                    label = "paraphrased"
                    confidence = sim
                elif sim >= 0.56:
                    label = "partial"
                    confidence = sim
            if label:
                rank = {"exact": 3, "paraphrased": 2, "partial": 1}[label]
                candidate = {
                    "label": label,
                    "confidence": round(confidence, 3),
                    "source": src,
                    "rank": rank,
                    "source_sentence": src_sentence,
                }
                if best is None or candidate["rank"] > best["rank"] or (
                    candidate["rank"] == best["rank"]
                    and candidate["confidence"] > best["confidence"]
                ):
                    best = candidate

        if best:
            counters[best["label"]] += sentence_words
            src: SourceRecord = best["source"]
            segments.append(
                {
                    "start": node["start"],
                    "end": node["end"],
                    "text": sentence,
                    "match_type": best["label"],
                    "confidence": best["confidence"],
                    "source_id": src.source_id,
                    "source_title": src.title,
                    "source_url": src.url,
                    "source_type": src.source_type,
                    "credibility": CREDIBILITY_LABEL[src.credibility],
                }
            )
            if src.source_id not in matched_source_map:
                matched_source_map[src.source_id] = {
                    "source_id": src.source_id,
                    "title": src.title,
                    "url": src.url,
                    "source_type": src.source_type,
                    "credibility": CREDIBILITY_LABEL[src.credibility],
                    "credibility_score": credibility_points(src.credibility),
                    "matched_segments": 1,
                }
            else:
                matched_source_map[src.source_id]["matched_segments"] += 1

    exact_pct = round(counters["exact"] / words_total * 100, 2)
    para_pct = round(counters["paraphrased"] / words_total * 100, 2)
    partial_pct = round(counters["partial"] / words_total * 100, 2)
    original_pct = round(max(100 - (exact_pct + para_pct + partial_pct), 0), 2)
    total_plagiarism = round(100 - original_pct, 2)

    matched_sources = sorted(
        list(matched_source_map.values()),
        key=lambda s: (s["credibility_score"], s["matched_segments"]),
        reverse=True,
    )
    matched_source_objs = [
        src for src in SOURCE_CORPUS if src.source_id in matched_source_map
    ]

    return {
        "breakdown": {
            "exact": exact_pct,
            "paraphrased": para_pct,
            "partial": partial_pct,
            "original": original_pct,
        },
        "plagiarism_percentage": total_plagiarism,
        "segments": segments,
        "matched_sources": matched_sources,
        "citation_suggestions": suggest_citations(matched_source_objs),
        "source_coverage": {
            "wikipedia": len(
                [m for m in matched_sources if m["source_type"] == "wikipedia"]
            ),
            "academic": len(
                [m for m in matched_sources if m["source_type"] == "academic_journal"]
            ),
            "news": len(
                [m for m in matched_sources if m["source_type"] == "news_article"]
            ),
            "competitor": len(
                [m for m in matched_sources if m["source_type"] == "competitor_website"]
            ),
            "social_media": len(
                [m for m in matched_sources if m["source_type"] == "social_media_post"]
            ),
        },
    }


def preserve_phrases(text: str, phrases: list[str]) -> tuple[str, dict[str, str]]:
    protected = {}
    processed = text
    for idx, phrase in enumerate(phrases):
        token = f"__PROTECTED_{idx}__"
        if phrase and phrase in processed:
            processed = processed.replace(phrase, token)
            protected[token] = phrase
    return processed, protected


def restore_phrases(text: str, protected_map: dict[str, str]) -> str:
    out = text
    for token, phrase in protected_map.items():
        out = out.replace(token, phrase)
    return out


def grammar_fix(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", text.strip())
    sentences = re.split(r"([.!?])", cleaned)
    rebuilt = ""
    for i in range(0, len(sentences), 2):
        piece = sentences[i].strip()
        if not piece:
            continue
        punctuation = sentences[i + 1] if i + 1 < len(sentences) else "."
        piece = piece[0].upper() + piece[1:] if len(piece) > 1 else piece.upper()
        rebuilt += piece + punctuation + " "
    return rebuilt.strip()


def replace_repetitive_words(
    text: str, intensity: float, seed: int
) -> tuple[str, int, list[dict[str, str]]]:
    rng = random.Random(seed)
    words = text.split()
    lowered = [re.sub(r"[^a-zA-Z]", "", w).lower() for w in words]
    frequency = Counter(lowered)
    changes = 0
    replacements: list[dict[str, str]] = []
    for idx, raw in enumerate(words):
        token = re.sub(r"[^a-zA-Z]", "", raw).lower()
        if token in SYNONYM_MAP and frequency[token] >= 2 and rng.random() < intensity:
            replacement = rng.choice(SYNONYM_MAP[token])
            punct = re.sub(r"[a-zA-Z]", "", raw)
            words[idx] = replacement + punct
            changes += 1
            replacements.append({"from": token, "to": replacement})
    return " ".join(words), changes, replacements


def style_analyzer(text: str) -> dict[str, Any]:
    lower = text.lower()
    contractions = len(re.findall(r"\b\w+'\w+\b", text))
    avg_sent = readability_metrics(text)["avg_sentence_length"]
    academic_markers = len(
        [w for w in ["therefore", "moreover", "hypothesis", "methodology"] if w in lower]
    )
    if contractions >= 4:
        style = "casual"
    elif academic_markers >= 2 or avg_sent > 23:
        style = "academic"
    elif "!" in text or "imagine" in lower:
        style = "creative"
    else:
        style = "professional"
    return {"detected_style": style, "contractions": contractions, "avg_sentence_length": avg_sent}


def content_enrichment_suggestions(text: str) -> list[str]:
    suggestions = []
    if not re.search(r"\d", text):
        suggestions.append("Add at least one data point or statistic to increase credibility.")
    if "for example" not in text.lower():
        suggestions.append("Add a concrete example to make the argument more relatable.")
    if len(split_sentences_with_offsets(text)) > 4 and "?" not in text:
        suggestions.append("Consider a rhetorical question to increase reader engagement.")
    if "however" not in text.lower() and "but" not in text.lower():
        suggestions.append("Add a contrast transition to improve flow between ideas.")
    return suggestions or ["Content is already rich and engaging."]


def apply_tone(text: str, tone: str, seed: int) -> tuple[str, int]:
    rng = random.Random(seed)
    tone = tone if tone in TONE_OPENERS else "professional"
    lines = split_sentences_with_offsets(text)
    if not lines:
        return text, 0
    rewritten = []
    rewritten_count = 0
    for idx, node in enumerate(lines):
        sentence = node["sentence"]
        if idx % 2 == 0 and len(sentence.split()) > 6:
            opener = rng.choice(TONE_OPENERS[tone])
            sentence = f"{opener} {sentence[0].lower() + sentence[1:] if len(sentence) > 1 else sentence.lower()}"
            rewritten_count += 1
        rewritten.append(sentence)
    return " ".join(rewritten), rewritten_count


def humanize_single(
    text: str,
    tone: str,
    level: int,
    protect_phrases: list[str],
    seed: int,
) -> dict[str, Any]:
    before_readability = readability_metrics(text)
    processed, protected_map = preserve_phrases(text, protect_phrases)
    fixed = grammar_fix(processed)
    toned, rewritten = apply_tone(fixed, tone, seed=seed + 7)
    intensity = min(max(level / 120, 0.2), 0.9)
    replaced, replaced_count, replacements = replace_repetitive_words(
        toned, intensity=intensity, seed=seed + 3
    )
    restored = restore_phrases(replaced, protected_map)
    after_readability = readability_metrics(restored)
    ai_after = detect_ai_patterns(restored)
    report = {
        "words_replaced": replaced_count,
        "phrases_restructured": rewritten,
        "sentences_rewritten": rewritten,
        "tone_adjusted": True,
        "preserved_phrases": protect_phrases,
        "replacement_samples": replacements[:20],
        "level_label": LEVEL_PRESETS.get(level, "Custom"),
    }
    return {
        "text": restored,
        "report": report,
        "readability_before": before_readability,
        "readability_after": after_readability,
        "ai_probability_after": ai_after["ai_generated_probability"],
    }


def persist_analysis(label: str, words: int, report: dict[str, Any], ai: float, readability: float, quality: float) -> None:
    conn = db_conn()
    conn.execute(
        """
        INSERT INTO analyses (id, created_at, label, words, exact, paraphrased, partial, original, ai_probability, readability, quality_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            str(uuid.uuid4()),
            dt.datetime.utcnow().isoformat(),
            label,
            words,
            report["breakdown"]["exact"],
            report["breakdown"]["paraphrased"],
            report["breakdown"]["partial"],
            report["breakdown"]["original"],
            ai,
            readability,
            quality,
        ),
    )
    conn.commit()
    conn.close()


def compare_documents(left_text: str, right_text: str) -> dict[str, Any]:
    left = split_sentences_with_offsets(left_text)
    right = split_sentences_with_offsets(right_text)
    matches = []
    for l_node in left:
        best = None
        for r_node in right:
            sim = sentence_similarity(l_node["sentence"], r_node["sentence"])
            if sim >= 0.62 and (best is None or sim > best["similarity"]):
                best = {
                    "left_sentence": l_node["sentence"],
                    "right_sentence": r_node["sentence"],
                    "similarity": round(sim * 100, 2),
                }
        if best:
            matches.append(best)
    similarity_pct = round(
        (len(matches) / max(len(left), 1)) * 100,
        2,
    )
    return {
        "similarity_percentage": similarity_pct,
        "matches": matches,
        "summary": f"{len(matches)} sentence-level similarities detected.",
    }


def export_pdf(report: dict[str, Any], humanized_text: str | None) -> bytes:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.setTitle("Plagiarism & Humanization Report")
    width, height = letter
    y = height - 40
    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, y, "Advanced Content Originality Report")
    y -= 24
    c.setFont("Helvetica", 10)
    c.drawString(40, y, f"Generated: {dt.datetime.utcnow().isoformat()} UTC")
    y -= 20
    breakdown = report.get("breakdown", {})
    lines = [
        f"Exact Match: {breakdown.get('exact', 0)}%",
        f"Paraphrased: {breakdown.get('paraphrased', 0)}%",
        f"Partial Similarity: {breakdown.get('partial', 0)}%",
        f"Original: {breakdown.get('original', 0)}%",
        f"AI-Generated Probability: {report.get('ai_generated_probability', 0)}%",
        f"Quality Score: {report.get('content_quality_score', {}).get('overall', 0)}",
    ]
    for line in lines:
        c.drawString(40, y, line)
        y -= 16
    y -= 8
    c.setFont("Helvetica-Bold", 11)
    c.drawString(40, y, "Matched Sources")
    y -= 16
    c.setFont("Helvetica", 9)
    for src in report.get("matched_sources", [])[:10]:
        text_line = f"- {src.get('title')} ({src.get('credibility')}) [{src.get('source_type')}]"
        c.drawString(40, y, text_line[:110])
        y -= 14
        if y < 80:
            c.showPage()
            y = height - 40
    if humanized_text:
        c.showPage()
        y = height - 40
        c.setFont("Helvetica-Bold", 11)
        c.drawString(40, y, "Humanized Output (excerpt)")
        y -= 18
        c.setFont("Helvetica", 9)
        excerpt = humanized_text[:1400]
        for line in re.findall(r".{1,90}(?:\s+|$)", excerpt):
            c.drawString(40, y, line.strip())
            y -= 12
            if y < 50:
                c.showPage()
                y = height - 40
    c.save()
    return buffer.getvalue()


def export_docx(report: dict[str, Any], humanized_text: str | None) -> bytes:
    doc = Document()
    doc.add_heading("Advanced Content Originality Report", level=1)
    doc.add_paragraph(f"Generated: {dt.datetime.utcnow().isoformat()} UTC")
    breakdown = report.get("breakdown", {})
    doc.add_paragraph(f"Exact Match: {breakdown.get('exact', 0)}%")
    doc.add_paragraph(f"Paraphrased: {breakdown.get('paraphrased', 0)}%")
    doc.add_paragraph(f"Partial Similarity: {breakdown.get('partial', 0)}%")
    doc.add_paragraph(f"Original: {breakdown.get('original', 0)}%")
    doc.add_paragraph(f"AI-Generated Probability: {report.get('ai_generated_probability', 0)}%")
    doc.add_paragraph(
        f"Quality Score: {report.get('content_quality_score', {}).get('overall', 0)}"
    )
    doc.add_heading("Matched Sources", level=2)
    for src in report.get("matched_sources", [])[:20]:
        doc.add_paragraph(
            f"{src.get('title')} | {src.get('credibility')} | {src.get('source_type')}",
            style="List Bullet",
        )
    if humanized_text:
        doc.add_heading("Humanized Text", level=2)
        doc.add_paragraph(humanized_text)
    buffer = io.BytesIO()
    doc.save(buffer)
    return buffer.getvalue()


@app.get("/")
def index() -> FileResponse:
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/plagiarism/check")
def check_plagiarism(req: TextRequest) -> dict[str, Any]:
    report = plagiarism_report(req.text)
    ai = detect_ai_patterns(req.text)
    readability = readability_metrics(req.text)
    grammar = grammar_score(req.text)
    quality = content_quality_score(
        originality=report["breakdown"]["original"],
        humanness=100 - ai["ai_generated_probability"],
        readability=readability["flesch"],
        grammar=grammar,
    )
    persist_analysis(
        label="plagiarism_check",
        words=len(tokenize(req.text)),
        report=report,
        ai=ai["ai_generated_probability"],
        readability=readability["flesch"],
        quality=quality["overall"],
    )
    return {
        **report,
        "ai_generated_probability": ai["ai_generated_probability"],
        "ai_pattern_detector": ai,
        "readability": readability,
        "readability_tips": readability_tips(readability),
        "content_quality_score": quality,
        "risk_predictor": {
            "risk_level": "high"
            if report["plagiarism_percentage"] > 30
            else "medium"
            if report["plagiarism_percentage"] > 12
            else "low",
            "confidence": round(
                min(97, 55 + report["plagiarism_percentage"] * 0.9), 2
            ),
        },
    }


@app.post("/api/realtime/analyze")
def realtime_analysis(req: TextRequest) -> dict[str, Any]:
    report = plagiarism_report(req.text)
    ai = detect_ai_patterns(req.text)
    readability = readability_metrics(req.text)
    return {
        "plagiarism_percentage": report["plagiarism_percentage"],
        "originality": report["breakdown"]["original"],
        "ai_generated_probability": ai["ai_generated_probability"],
        "readability": readability["flesch"],
        "tips": readability_tips(readability),
    }


@app.post("/api/plagiarism/batch")
def batch_check(req: BatchRequest) -> dict[str, Any]:
    job_id = str(uuid.uuid4())
    rows: list[dict[str, Any]] = []
    for idx, doc in enumerate(req.documents):
        report = plagiarism_report(doc.text)
        ai = detect_ai_patterns(doc.text)
        row = {
            "document_id": doc.document_id or f"doc-{idx+1}",
            "title": doc.title or f"Document {idx+1}",
            "plagiarism_percentage": report["plagiarism_percentage"],
            "originality": report["breakdown"]["original"],
            "exact": report["breakdown"]["exact"],
            "paraphrased": report["breakdown"]["paraphrased"],
            "partial": report["breakdown"]["partial"],
            "ai_generated_probability": ai["ai_generated_probability"],
        }
        rows.append(row)
    csv_buffer = io.StringIO()
    writer = csv.DictWriter(csv_buffer, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)
    return {
        "job_id": job_id,
        "status": "completed",
        "email_notification": bool(req.email),
        "results": rows,
        "csv_export": csv_buffer.getvalue(),
    }


@app.post("/api/plagiarism/compare")
def compare(req: CompareRequest) -> dict[str, Any]:
    return compare_documents(req.left_text, req.right_text)


@app.post("/api/humanize")
def humanize(req: HumanizeRequest) -> dict[str, Any]:
    if req.tone not in TONE_OPENERS:
        raise HTTPException(status_code=400, detail="Unsupported tone selected.")
    style = style_analyzer(req.text)
    ai_patterns = detect_ai_patterns(req.text)
    versions = []
    for idx in range(req.versions):
        variant = humanize_single(
            req.text,
            tone=req.tone,
            level=req.level,
            protect_phrases=req.protect_phrases,
            seed=idx + 11,
        )
        version_plagiarism = plagiarism_report(variant["text"])
        quality = content_quality_score(
            originality=version_plagiarism["breakdown"]["original"],
            humanness=100 - variant["ai_probability_after"],
            readability=variant["readability_after"]["flesch"],
            grammar=grammar_score(variant["text"]),
        )
        versions.append(
            {
                "version_id": idx + 1,
                "tone": req.tone,
                "text": variant["text"],
                "report": variant["report"],
                "readability_before": variant["readability_before"],
                "readability_after": variant["readability_after"],
                "originality_after_humanization": version_plagiarism["breakdown"][
                    "original"
                ],
                "plagiarism_after_humanization": version_plagiarism[
                    "plagiarism_percentage"
                ],
                "ai_generated_probability_after": variant["ai_probability_after"],
                "content_quality_score": quality,
            }
        )

    best = sorted(
        versions,
        key=lambda v: (
            v["content_quality_score"]["overall"],
            v["originality_after_humanization"],
            -v["ai_generated_probability_after"],
        ),
        reverse=True,
    )[0]
    persist_analysis(
        label="humanizer",
        words=len(tokenize(req.text)),
        report={
            "breakdown": {
                "exact": 0,
                "paraphrased": 0,
                "partial": 0,
                "original": best["originality_after_humanization"],
            }
        },
        ai=best["ai_generated_probability_after"],
        readability=best["readability_after"]["flesch"],
        quality=best["content_quality_score"]["overall"],
    )
    return {
        "tone": req.tone,
        "level": req.level,
        "level_label": LEVEL_PRESETS.get(req.level, "Custom"),
        "style_analyzer": style,
        "ai_pattern_detector": ai_patterns,
        "content_enrichment_suggestions": content_enrichment_suggestions(req.text),
        "versions": versions,
        "best_version": best,
        "before_after_comparison": {
            "before": req.text,
            "after": best["text"],
        },
    }


@app.post("/api/optimize")
def optimize(req: OptimizeRequest) -> dict[str, Any]:
    pre = check_plagiarism(TextRequest(text=req.text))
    need_humanize = (
        pre["ai_generated_probability"] > 20 or pre["plagiarism_percentage"] > 10
    )
    if not need_humanize:
        return {
            "optimized": False,
            "message": "Content already looks strong. No heavy rewrite required.",
            "initial_report": pre,
        }
    humanized = humanize(
        HumanizeRequest(
            text=req.text,
            tone=req.tone,
            level=req.level,
            versions=5,
            protect_phrases=req.protect_phrases,
        )
    )
    return {
        "optimized": True,
        "workflow": [
            "Plagiarism check completed",
            "AI pattern detection completed",
            "Humanization and grammar fix applied",
            "Quality score recomputed",
        ],
        "initial_report": pre,
        "humanized_report": humanized,
    }


@app.get("/api/history/stats")
def history_stats() -> dict[str, Any]:
    conn = db_conn()
    totals = conn.execute(
        """
        SELECT
          COUNT(*) AS total_checks,
          SUM(words) AS total_words,
          AVG(100 - original) AS avg_plagiarism,
          SUM(CASE WHEN label = 'humanizer' THEN 1 ELSE 0 END) AS humanized_count,
          AVG(quality_score) AS avg_quality
        FROM analyses
        """
    ).fetchone()
    conn.close()
    return {
        "total_content_checked": totals["total_checks"] or 0,
        "average_plagiarism": round(totals["avg_plagiarism"] or 0, 2),
        "content_humanized": totals["humanized_count"] or 0,
        "total_words_improved": totals["total_words"] or 0,
        "average_quality_score": round(totals["avg_quality"] or 0, 2),
    }


@app.get("/api/history/timeline")
def history_timeline() -> dict[str, Any]:
    conn = db_conn()
    rows = conn.execute(
        """
        SELECT created_at, 100 - original AS plagiarism, ai_probability, quality_score
        FROM analyses
        ORDER BY created_at DESC
        LIMIT 30
        """
    ).fetchall()
    conn.close()
    points = [
        {
            "timestamp": row["created_at"],
            "plagiarism": round(row["plagiarism"], 2),
            "ai_probability": round(row["ai_probability"], 2),
            "quality_score": round(row["quality_score"], 2),
        }
        for row in reversed(rows)
    ]
    return {"points": points}


@app.get("/api/insights")
def insights() -> dict[str, Any]:
    conn = db_conn()
    rows = conn.execute(
        """
        SELECT label, AVG(100 - original) AS avg_plagiarism, AVG(ai_probability) AS avg_ai, AVG(readability) AS avg_readability
        FROM analyses
        GROUP BY label
        """
    ).fetchall()
    conn.close()
    return {
        "content_insights": [
            {
                "type": row["label"],
                "average_plagiarism": round(row["avg_plagiarism"], 2),
                "average_ai_probability": round(row["avg_ai"], 2),
                "average_readability": round(row["avg_readability"], 2),
            }
            for row in rows
        ],
        "seo_analysis_hint": "Use one H1, meaningful H2s, and keep keyword density below 2.5%.",
    }


@app.post("/api/export")
def export_report(req: ExportRequest):
    export_name = f"{req.filename}-{dt.datetime.utcnow().strftime('%Y%m%d-%H%M%S')}"
    if req.export_format == "google_docs":
        return JSONResponse(
            {
                "google_docs_link": f"https://docs.google.com/document/d/{uuid.uuid4()}",
                "note": "Stub link for integration demo. Replace with real Google Docs API flow.",
            }
        )
    if req.export_format == "pdf":
        payload = export_pdf(req.report, req.humanized_text)
        return StreamingResponse(
            io.BytesIO(payload),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{export_name}.pdf"'},
        )
    if req.export_format == "docx":
        payload = export_docx(req.report, req.humanized_text)
        return StreamingResponse(
            io.BytesIO(payload),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{export_name}.docx"'},
        )
    if req.export_format in {"txt", "md"}:
        pretty = io.StringIO()
        pretty.write("Advanced Content Originality Report\n")
        pretty.write("=" * 36 + "\n")
        breakdown = req.report.get("breakdown", {})
        pretty.write(f"Exact: {breakdown.get('exact', 0)}%\n")
        pretty.write(f"Paraphrased: {breakdown.get('paraphrased', 0)}%\n")
        pretty.write(f"Partial: {breakdown.get('partial', 0)}%\n")
        pretty.write(f"Original: {breakdown.get('original', 0)}%\n")
        pretty.write(f"AI Probability: {req.report.get('ai_generated_probability', 0)}%\n")
        if req.humanized_text:
            pretty.write("\nHumanized Text:\n")
            pretty.write(req.humanized_text)
        media = "text/markdown" if req.export_format == "md" else "text/plain"
        return StreamingResponse(
            io.BytesIO(pretty.getvalue().encode("utf-8")),
            media_type=media,
            headers={"Content-Disposition": f'attachment; filename="{export_name}.{req.export_format}"'},
        )
    raise HTTPException(status_code=400, detail="Unsupported export format.")
