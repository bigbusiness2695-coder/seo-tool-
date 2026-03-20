const MODEL = process.env.OLLAMA_MODEL || "mistral";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function tempFromIntensity(intensity) {
  const level = clamp(Number(intensity ?? 50), 0, 100);
  return Number((0.2 + (level / 100) * 0.9).toFixed(2));
}

function promptFor(text, intensity, variant = 1) {
  const level = clamp(Number(intensity ?? 50), 0, 100);
  const mode =
    level < 30
      ? "Make slight edits while preserving wording."
      : level < 70
        ? "Rewrite with noticeable variation and human flow."
        : "Completely rewrite in natural human style while preserving meaning.";

  return [
    "You are a text humanizer.",
    mode,
    `Variation preference #${variant}.`,
    "Avoid robotic transitions and repetitive structure.",
    "Return only the rewritten text without labels.",
    "",
    "INPUT:",
    text
  ].join("\n");
}

function fallbackHumanize(text, intensity, variant = 1) {
  const level = clamp(Number(intensity ?? 50), 0, 100);
  const sentenceJoiner = level < 40 ? " " : " ";
  const lines = text.split(/([.!?])/).filter(Boolean);
  let output = "";
  for (let i = 0; i < lines.length; i += 2) {
    const sentence = (lines[i] || "").trim();
    if (!sentence) continue;
    const punct = lines[i + 1] || ".";
    let rewritten = sentence;
    if (level >= 20) rewritten = rewritten.replace(/\bvery\b/gi, "quite");
    if (level >= 40) rewritten = rewritten.replace(/\bimportant\b/gi, "key");
    if (level >= 60) rewritten = rewritten.replace(/\buse\b/gi, "leverage");
    if (level >= 80 && variant % 2 === 0) {
      rewritten = `In practical terms, ${rewritten.charAt(0).toLowerCase()}${rewritten.slice(1)}`;
    }
    output += `${rewritten}${punct}${sentenceJoiner}`;
  }
  return output.trim();
}

async function ollamaGenerate(text, intensity, variant = 1) {
  const payload = {
    model: MODEL,
    prompt: promptFor(text, intensity, variant),
    stream: false,
    options: {
      temperature: tempFromIntensity(intensity)
    }
  };

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Ollama failed with status ${response.status}`);
  }
  const data = await response.json();
  return data?.response?.trim() || "";
}

function summarizeDiff(original, rewritten) {
  const o = original.split(/\s+/).filter(Boolean);
  const r = rewritten.split(/\s+/).filter(Boolean);
  const delta = Math.abs(r.length - o.length);
  const ratio = o.length ? Math.min(100, Math.round((delta / o.length) * 100)) : 0;
  return {
    originalWords: o.length,
    rewrittenWords: r.length,
    estimatedChangePercent: ratio
  };
}

export async function humanizeText(text, intensity = 50, versions = 5) {
  const count = clamp(Number(versions ?? 5), 1, 5);
  const outputs = [];
  const warnings = [];

  for (let i = 1; i <= count; i += 1) {
    try {
      const rewritten = await ollamaGenerate(text, intensity, i);
      outputs.push({
        version: i,
        text: rewritten,
        diffStats: summarizeDiff(text, rewritten),
        provider: "ollama"
      });
    } catch (error) {
      const rewritten = fallbackHumanize(text, intensity, i);
      warnings.push(`Ollama unavailable for version ${i}: ${error.message}`);
      outputs.push({
        version: i,
        text: rewritten,
        diffStats: summarizeDiff(text, rewritten),
        provider: "fallback-rule-engine"
      });
    }
  }

  return {
    originalText: text,
    intensity: clamp(Number(intensity ?? 50), 0, 100),
    versions: outputs,
    bestVersion: outputs[0],
    warnings
  };
}
