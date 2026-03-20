import { envConfigured } from "./integrations.js";

const STOP_WORDS = new Set([
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
  "at"
]);

const SOURCE_DB = [
  {
    id: "wiki-climate",
    sourceType: "wikipedia",
    credibility: "trusted",
    url: "https://en.wikipedia.org/wiki/Climate_change",
    phrase:
      "Climate change includes global warming driven by human emissions of greenhouse gases."
  },
  {
    id: "academic-learning",
    sourceType: "academic_journal",
    credibility: "trusted",
    url: "https://example.edu/journal/learning-analytics",
    phrase:
      "Learning analytics models student performance using historical interaction data and requires ethical transparency."
  },
  {
    id: "news-ai",
    sourceType: "news_article",
    credibility: "trusted",
    url: "https://example-news.com/ai-workplaces",
    phrase:
      "Companies are integrating AI copilots to draft emails summarize meetings and assist support teams."
  },
  {
    id: "competitor-seo",
    sourceType: "competitor_website",
    credibility: "medium",
    url: "https://competitor-content.com/seo-strategies",
    phrase:
      "High ranking articles satisfy search intent use structured headings and answer user questions quickly."
  },
  {
    id: "social-growth",
    sourceType: "social_media_post",
    credibility: "untrusted",
    url: "https://social.example/thread/8921",
    phrase:
      "Consistency beats virality publish useful insights weekly and engage with comments to build trust."
  }
];

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9']+/g) || []).filter(
    (t) => !STOP_WORDS.has(t)
  );
}

function sentenceSplit(text) {
  return (text.match(/[^.!?\n]+[.!?]?/g) || []).map((s) => s.trim()).filter(Boolean);
}

function jaccard(a, b) {
  const s1 = new Set(tokenize(a));
  const s2 = new Set(tokenize(b));
  if (!s1.size || !s2.size) return 0;
  let overlap = 0;
  for (const item of s1) {
    if (s2.has(item)) overlap += 1;
  }
  return overlap / (s1.size + s2.size - overlap);
}

function seqRatio(a, b) {
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  if (!s1.length || !s2.length) return 0;
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  let same = 0;
  for (const ch of shorter) {
    if (longer.includes(ch)) same += 1;
  }
  return same / longer.length;
}

function credibilityLabel(level) {
  if (level === "trusted") return "✓ Trusted";
  if (level === "medium") return "⚠️ Medium";
  return "✗ Untrusted";
}

function riskFromPercentage(percentage) {
  if (percentage <= 10) return { status: "Low Risk", color: "green" };
  if (percentage <= 30) return { status: "Medium Risk", color: "yellow" };
  return { status: "High Risk", color: "red" };
}

function heuristicPlagiarism(text) {
  const inputSentences = sentenceSplit(text);
  let exactWords = 0;
  let paraphraseWords = 0;
  let partialWords = 0;
  const matches = [];
  const totalWords = Math.max(tokenize(text).length, 1);

  for (const sentence of inputSentences) {
    const wordCount = Math.max(tokenize(sentence).length, 1);
    let best = null;
    for (const src of SOURCE_DB) {
      const jac = jaccard(sentence, src.phrase);
      const seq = seqRatio(sentence, src.phrase);
      const score = jac * 0.7 + seq * 0.3;
      let type = null;
      if (sentence.toLowerCase() === src.phrase.toLowerCase() || score > 0.93) {
        type = "exact";
      } else if (score >= 0.72) {
        type = "paraphrased";
      } else if (score >= 0.52) {
        type = "partial";
      }
      if (type) {
        if (!best || score > best.score) {
          best = { ...src, score, type };
        }
      }
    }

    if (best) {
      if (best.type === "exact") exactWords += wordCount;
      if (best.type === "paraphrased") paraphraseWords += wordCount;
      if (best.type === "partial") partialWords += wordCount;
      matches.push({
        phrase: sentence,
        matchType: best.type,
        confidence: Number((best.score * 100).toFixed(2)),
        sourceType: best.sourceType,
        credibility: credibilityLabel(best.credibility),
        sourceUrl: best.url
      });
    }
  }

  const exact = Number(((exactWords / totalWords) * 100).toFixed(2));
  const paraphrased = Number(((paraphraseWords / totalWords) * 100).toFixed(2));
  const partial = Number(((partialWords / totalWords) * 100).toFixed(2));
  const plagiarismPercentage = Number((exact + paraphrased + partial).toFixed(2));
  const original = Number(Math.max(0, 100 - plagiarismPercentage).toFixed(2));
  const risk = riskFromPercentage(plagiarismPercentage);

  return {
    provider: "heuristic-fallback",
    plagiarismPercentage,
    progressColor: risk.color,
    status: risk.status,
    characterCount: text.length,
    breakdown: { exact, paraphrased, partial, original },
    matchingSources: matches
  };
}

function parsePlagScanResponse(data, text) {
  const percentage = Number(
    data?.plagiarism_percentage ?? data?.similarity ?? data?.score ?? 0
  );
  const risk = riskFromPercentage(percentage);
  return {
    provider: "plagscan",
    plagiarismPercentage: percentage,
    progressColor: risk.color,
    status: risk.status,
    characterCount: text.length,
    breakdown: {
      exact: Number(data?.exact_match ?? 0),
      paraphrased: Number(data?.paraphrased ?? 0),
      partial: Number(data?.partial ?? 0),
      original: Number(data?.original ?? Math.max(0, 100 - percentage))
    },
    matchingSources: (data?.sources || []).map((s) => ({
      phrase: s.phrase || s.text || "Matched fragment",
      matchType: s.match_type || "partial",
      confidence: Number(s.confidence || 0),
      sourceType: s.source_type || "web",
      credibility: s.credibility || "Unknown",
      sourceUrl: s.url || "#"
    }))
  };
}

function normalizeGenericPlagiarism(provider, data, text) {
  const percentage = Number(
    data?.plagiarism_percentage ??
      data?.similarity ??
      data?.score ??
      data?.result?.score ??
      0
  );
  const risk = riskFromPercentage(percentage);
  return {
    provider,
    plagiarismPercentage: percentage,
    progressColor: risk.color,
    status: risk.status,
    characterCount: text.length,
    breakdown: {
      exact: Number(data?.exact_match ?? data?.breakdown?.exact ?? 0),
      paraphrased: Number(data?.paraphrased ?? data?.breakdown?.paraphrased ?? 0),
      partial: Number(data?.partial ?? data?.breakdown?.partial ?? 0),
      original: Number(
        data?.original ??
          data?.breakdown?.original ??
          Math.max(0, 100 - percentage)
      )
    },
    matchingSources: (data?.sources || data?.matches || []).map((s) => ({
      phrase: s.phrase || s.text || "Matched fragment",
      matchType: s.match_type || s.matchType || "partial",
      confidence: Number(s.confidence || s.score || 0),
      sourceType: s.source_type || s.sourceType || "web",
      credibility: s.credibility || "Unknown",
      sourceUrl: s.url || s.sourceUrl || "#"
    }))
  };
}

async function callJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function checkWithPlagScan(text) {
  const apiKey = process.env.PLAGSCAN_API_KEY;
  const apiSecret = process.env.PLAGSCAN_API_SECRET;
  const apiUrl =
    process.env.PLAGSCAN_API_URL ||
    "https://api.plagscan.com/v1/plagiarism/check";

  if (!apiKey) throw new Error("PLAGSCAN_API_KEY missing");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`
  };
  if (apiSecret) headers["x-api-secret"] = apiSecret;
  const data = await callJson(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ text })
  });
  return parsePlagScanResponse(data, text);
}

async function checkWithCopyscape(text) {
  if (!envConfigured("COPYSCAPE_USERNAME", "COPYSCAPE_API_KEY")) {
    throw new Error("Copyscape credentials missing");
  }
  const apiUrl =
    process.env.COPYSCAPE_API_URL || "https://www.copyscape.com/api/";
  const body = new URLSearchParams({
    u: process.env.COPYSCAPE_USERNAME,
    k: process.env.COPYSCAPE_API_KEY,
    o: "csearch",
    t: text
  });
  const data = await callJson(apiUrl, { method: "POST", body });
  return normalizeGenericPlagiarism("copyscape", data, text);
}

async function checkWithTurnitin(text) {
  if (!envConfigured("TURNITIN_API_KEY", "TURNITIN_API_SECRET")) {
    throw new Error("Turnitin credentials missing");
  }
  const apiUrl =
    process.env.TURNITIN_API_URL ||
    "https://api.turnitin.com/api/v1/similarity/check";
  const data = await callJson(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.TURNITIN_API_KEY,
      "X-API-Secret": process.env.TURNITIN_API_SECRET
    },
    body: JSON.stringify({ text })
  });
  return normalizeGenericPlagiarism("turnitin", data, text);
}

async function checkWithQuetext(text) {
  if (!envConfigured("QUETEXT_API_KEY")) {
    throw new Error("Quetext API key missing");
  }
  const apiUrl =
    process.env.QUETEXT_API_URL || "https://www.quetext.com/api/v1/check";
  const data = await callJson(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.QUETEXT_API_KEY}`
    },
    body: JSON.stringify({ text })
  });
  return normalizeGenericPlagiarism("quetext", data, text);
}

async function checkWithUnicheck(text) {
  if (!envConfigured("UNICHECK_CLIENT_ID", "UNICHECK_CLIENT_SECRET")) {
    throw new Error("Unicheck credentials missing");
  }
  const apiUrl =
    process.env.UNICHECK_API_URL || "https://api.unicheck.com/v1/checks";
  const data = await callJson(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Id": process.env.UNICHECK_CLIENT_ID,
      "X-Client-Secret": process.env.UNICHECK_CLIENT_SECRET
    },
    body: JSON.stringify({ text })
  });
  return normalizeGenericPlagiarism("unicheck", data, text);
}

export async function checkPlagiarism(text) {
  const providerOrder = (
    process.env.PLAGIARISM_PROVIDER_ORDER ||
    "plagscan,copyscape,turnitin,quetext,unicheck"
  )
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

  const providers = {
    plagscan: checkWithPlagScan,
    copyscape: checkWithCopyscape,
    turnitin: checkWithTurnitin,
    quetext: checkWithQuetext,
    unicheck: checkWithUnicheck
  };
  const attempts = [];

  for (const name of providerOrder) {
    const fn = providers[name];
    if (!fn) continue;
    try {
      const result = await fn(text);
      return { ...result, attempts };
    } catch (error) {
      attempts.push({ provider: name, success: false, reason: error.message });
    }
  }

  return {
    ...heuristicPlagiarism(text),
    attempts,
    warning:
      "No external plagiarism provider succeeded. Returned heuristic local analysis fallback."
  };
}
