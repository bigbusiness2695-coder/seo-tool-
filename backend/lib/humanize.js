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

async function cohereGenerate(text, intensity, variant = 1) {
  const key = process.env.COHERE_API_KEY;
  if (!key) throw new Error("COHERE_API_KEY missing");
  const response = await fetch("https://api.cohere.com/v2/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: process.env.COHERE_MODEL || "command-r",
      temperature: tempFromIntensity(intensity),
      messages: [
        {
          role: "user",
          content: promptFor(text, intensity, variant)
        }
      ]
    })
  });
  if (!response.ok) {
    throw new Error(`Cohere failed with status ${response.status}`);
  }
  const data = await response.json();
  return (
    data?.message?.content?.[0]?.text?.trim() ||
    data?.text?.trim() ||
    ""
  );
}

async function huggingfaceGenerate(text, intensity, variant = 1) {
  const key = process.env.HUGGINGFACE_API_KEY;
  const model =
    process.env.HUGGINGFACE_MODEL || "mistralai/Mistral-7B-Instruct-v0.2";
  if (!key) throw new Error("HUGGINGFACE_API_KEY missing");
  const response = await fetch(
    `https://api-inference.huggingface.co/models/${model}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        inputs: promptFor(text, intensity, variant),
        parameters: {
          temperature: tempFromIntensity(intensity),
          return_full_text: false
        }
      })
    }
  );
  if (!response.ok) {
    throw new Error(`HuggingFace failed with status ${response.status}`);
  }
  const data = await response.json();
  if (Array.isArray(data)) {
    return data[0]?.generated_text?.trim() || "";
  }
  return data?.generated_text?.trim() || "";
}

async function openAiGenerate(text, intensity, variant = 1) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: tempFromIntensity(intensity),
      messages: [{ role: "user", content: promptFor(text, intensity, variant) }]
    })
  });
  if (!response.ok) {
    throw new Error(`OpenAI failed with status ${response.status}`);
  }
  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

async function claudeGenerate(text, intensity, variant = 1) {
  const key = process.env.CLAUDE_API_KEY;
  if (!key) throw new Error("CLAUDE_API_KEY missing");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || "claude-3-haiku-20240307",
      max_tokens: 1200,
      temperature: tempFromIntensity(intensity),
      messages: [{ role: "user", content: promptFor(text, intensity, variant) }]
    })
  });
  if (!response.ok) {
    throw new Error(`Claude failed with status ${response.status}`);
  }
  const data = await response.json();
  return data?.content?.[0]?.text?.trim() || "";
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
  const order = (
    process.env.HUMANIZER_PROVIDER_ORDER ||
    "ollama,cohere,huggingface,openai,claude"
  )
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

  const providers = {
    ollama: ollamaGenerate,
    cohere: cohereGenerate,
    huggingface: huggingfaceGenerate,
    openai: openAiGenerate,
    claude: claudeGenerate
  };

  for (let i = 1; i <= count; i += 1) {
    let generated = null;
    for (const name of order) {
      const fn = providers[name];
      if (!fn) continue;
      try {
        const textOut = await fn(text, intensity, i);
        if (textOut?.trim()) {
          generated = { text: textOut, provider: name };
          break;
        }
      } catch (error) {
        warnings.push(`${name} unavailable for version ${i}: ${error.message}`);
      }
    }
    if (!generated) {
      generated = {
        text: fallbackHumanize(text, intensity, i),
        provider: "fallback-rule-engine"
      };
    }
    outputs.push({
      version: i,
      text: generated.text,
      diffStats: summarizeDiff(text, generated.text),
      provider: generated.provider
    });
  }

  return {
    originalText: text,
    intensity: clamp(Number(intensity ?? 50), 0, 100),
    versions: outputs,
    bestVersion: outputs[0],
    warnings
  };
}
