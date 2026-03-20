import { envConfigured } from "./integrations.js";

function localGrammarHeuristic(text) {
  const issues = [];
  const duplicateSpaces = (text.match(/\s{2,}/g) || []).length;
  if (duplicateSpaces > 0) {
    issues.push({
      rule: "spacing",
      message: "Multiple consecutive spaces detected.",
      count: duplicateSpaces
    });
  }
  const noFinalPunctuation =
    text.trim().length > 0 && !/[.!?]$/.test(text.trim()) ? 1 : 0;
  if (noFinalPunctuation) {
    issues.push({
      rule: "punctuation",
      message: "Text may be missing ending punctuation.",
      count: 1
    });
  }

  const readabilityPenalty = Math.min(issues.length * 10, 30);
  return {
    provider: "local-heuristic",
    score: Math.max(70, 100 - readabilityPenalty),
    issues
  };
}

async function languageToolCheck(text, language = "en-US") {
  const base = process.env.LANGUAGETOOL_URL || "https://api.languagetool.org/v2";
  const url = `${base}/check`;
  const body = new URLSearchParams({ text, language });
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) {
    throw new Error(`LanguageTool failed with status ${response.status}`);
  }
  const data = await response.json();
  return {
    provider: "languagetool",
    score: Math.max(0, 100 - Math.min((data.matches || []).length * 3, 80)),
    issues: (data.matches || []).slice(0, 30).map((m) => ({
      rule: m.rule?.id || "unknown",
      message: m.message,
      offset: m.offset,
      length: m.length,
      suggestions: (m.replacements || []).slice(0, 3).map((r) => r.value)
    }))
  };
}

export async function checkGrammar(text, language = "en-US") {
  if (!text.trim()) {
    return { provider: "none", score: 100, issues: [] };
  }

  try {
    if (envConfigured("LANGUAGETOOL_URL") || !process.env.LANGUAGETOOL_URL) {
      return await languageToolCheck(text, language);
    }
  } catch (error) {
    return {
      ...localGrammarHeuristic(text),
      warning: `LanguageTool unavailable (${error.message}). Returned fallback checks.`
    };
  }
  return localGrammarHeuristic(text);
}
