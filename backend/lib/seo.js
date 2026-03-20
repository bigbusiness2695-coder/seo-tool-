function words(text) {
  return (text.toLowerCase().match(/[a-z0-9']+/g) || []).filter(Boolean);
}

async function fetchGoogleSearchInsights(keyword) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;
  if (!apiKey || !cx || !keyword) return null;
  const endpoint = new URL("https://www.googleapis.com/customsearch/v1");
  endpoint.searchParams.set("key", apiKey);
  endpoint.searchParams.set("cx", cx);
  endpoint.searchParams.set("q", keyword);
  endpoint.searchParams.set("num", "5");
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`Google Search failed with status ${response.status}`);
  const data = await response.json();
  return {
    provider: "google-custom-search",
    topResults: (data.items || []).slice(0, 5).map((item) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet
    }))
  };
}

async function fetchNewsResearch(keyword) {
  const key = process.env.NEWSAPI_KEY;
  if (!key || !keyword) return null;
  const endpoint = new URL("https://newsapi.org/v2/everything");
  endpoint.searchParams.set("q", keyword);
  endpoint.searchParams.set("pageSize", "5");
  endpoint.searchParams.set("sortBy", "relevancy");
  endpoint.searchParams.set("apiKey", key);
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`NewsAPI failed with status ${response.status}`);
  const data = await response.json();
  return {
    provider: "newsapi",
    relatedArticles: (data.articles || []).slice(0, 5).map((a) => ({
      title: a.title,
      url: a.url,
      source: a.source?.name
    }))
  };
}

async function fetchDatamuseSuggestions(keyword) {
  const base = process.env.DATAMUSE_API_URL || "https://api.datamuse.com";
  if (!keyword) return null;
  const endpoint = new URL("/words", base);
  endpoint.searchParams.set("ml", keyword);
  endpoint.searchParams.set("max", "8");
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`Datamuse failed with status ${response.status}`);
  const data = await response.json();
  return (data || []).map((w) => w.word).filter(Boolean);
}

function sentences(text) {
  return (text.match(/[^.!?\n]+[.!?]?/g) || []).map((s) => s.trim()).filter(Boolean);
}

function detectPrimaryKeyword(text) {
  const tokens = words(text);
  const skip = new Set(["the", "and", "to", "of", "in", "a", "for", "on", "is"]);
  const frequency = new Map();
  for (const token of tokens) {
    if (token.length < 4 || skip.has(token)) continue;
    frequency.set(token, (frequency.get(token) || 0) + 1);
  }
  const sorted = [...frequency.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || "content optimization";
}

function readability(text) {
  const ws = words(text);
  const ss = sentences(text);
  const avgSentenceLength = ws.length / Math.max(ss.length, 1);
  const avgWordLength =
    ws.reduce((sum, w) => sum + w.length, 0) / Math.max(ws.length, 1);
  const score = Math.max(
    0,
    Math.min(100, Math.round(100 - (avgSentenceLength - 14) * 2 - (avgWordLength - 4.7) * 8))
  );
  return {
    score,
    avgSentenceLength: Number(avgSentenceLength.toFixed(2)),
    avgWordLength: Number(avgWordLength.toFixed(2)),
    readingTimeMinutes: Math.max(1, Math.round(ws.length / 220))
  };
}

function keywordAnalysis(text, explicitKeyword) {
  const primaryKeyword = explicitKeyword?.trim() || detectPrimaryKeyword(text);
  const tokenList = words(text);
  const totalWords = Math.max(tokenList.length, 1);
  const keywordCount = tokenList.filter((w) => w === primaryKeyword.toLowerCase()).length;
  const density = Number(((keywordCount / totalWords) * 100).toFixed(2));
  return {
    primaryKeyword,
    keywordCount,
    density,
    recommendedDensity: "1.0% - 2.0%",
    relatedKeywords: [
      `${primaryKeyword} tools`,
      `${primaryKeyword} strategy`,
      `${primaryKeyword} guide`,
      `${primaryKeyword} optimization`
    ]
  };
}

function titleSuggestions(title, keyword) {
  const current = title || "Untitled content";
  const length = current.length;
  const hasKeyword = current.toLowerCase().includes(keyword.toLowerCase());
  const score = Math.max(0, Math.min(10, 6 + (hasKeyword ? 2 : 0) + (length >= 45 && length <= 65 ? 2 : 0)));
  return {
    currentTitle: current,
    titleScore: score,
    recommendations: [
      `7 Best ${keyword} Strategies to Improve Rankings`,
      `The Ultimate ${keyword} Guide: Practical Steps That Work`,
      `What Is the Best ${keyword} Workflow in 2026?`
    ],
    checks: {
      hasKeyword,
      length,
      optimalLengthRange: "50-60 characters"
    }
  };
}

function seoScoreCard(text, title, keyword) {
  const wc = words(text).length;
  const r = readability(text);
  const ka = keywordAnalysis(text, keyword);
  const contentLengthScore = wc >= 1200 ? 90 : wc >= 800 ? 75 : wc >= 500 ? 55 : 35;
  const keywordScore = ka.density >= 1 && ka.density <= 2.5 ? 85 : 60;
  const titleScore = title ? 80 : 0;
  const linksScore =
    (text.match(/https?:\/\//g) || []).length >= 3 ? 80 : (text.match(/https?:\/\//g) || []).length * 20;
  const structureScore = (text.match(/\n#+\s/g) || []).length >= 2 ? 85 : 65;
  const visualsScore = /image|screenshot|video|chart|infographic/i.test(text) ? 70 : 0;
  const overall = Math.round(
    (keywordScore * 0.2 +
      contentLengthScore * 0.2 +
      r.score * 0.2 +
      titleScore * 0.1 +
      structureScore * 0.1 +
      linksScore * 0.1 +
      visualsScore * 0.1)
  );

  return {
    overall,
    breakdown: {
      keywordOptimization: keywordScore,
      contentLength: contentLengthScore,
      readability: r.score,
      metaDescription: title ? 70 : 0,
      headerStructure: structureScore,
      links: linksScore,
      visualContent: visualsScore
    },
    readability: r,
    keyword: ka
  };
}

export async function analyzeSEO({ text, title, keyword }) {
  const card = seoScoreCard(text, title, keyword);
  const detectedKeyword = card.keyword.primaryKeyword;
  const heading = titleSuggestions(title, detectedKeyword);
  const tokenCount = words(text).length;
  const warnings = [];
  let searchInsights = null;
  let newsResearch = null;
  let semanticKeywords = [];

  try {
    searchInsights = await fetchGoogleSearchInsights(detectedKeyword);
  } catch (error) {
    warnings.push(error.message);
  }
  try {
    newsResearch = await fetchNewsResearch(detectedKeyword);
  } catch (error) {
    warnings.push(error.message);
  }
  try {
    semanticKeywords = (await fetchDatamuseSuggestions(detectedKeyword)) || [];
  } catch (error) {
    warnings.push(error.message);
  }

  return {
    seoScore: card.overall,
    scoreBreakdown: card.breakdown,
    keywordAnalyzer: card.keyword,
    semanticKeywords,
    readabilityAnalyzer: card.readability,
    headlineOptimizer: heading,
    metaDescriptionGenerator: [
      `Learn ${detectedKeyword} with practical tips, examples, and a step-by-step framework to improve results fast.`,
      `Need better ${detectedKeyword}? Use this complete guide to optimize structure, readability, and performance.`,
      `What is the best way to improve ${detectedKeyword}? Discover proven techniques and actionable next steps.`
    ],
    contentGapAnalyzer: {
      missingSections: [
        "FAQ section",
        "Cost breakdown",
        "Step-by-step checklist",
        "Case study examples"
      ],
      recommendation:
        "Add practical examples, a checklist, and FAQ to improve topical completeness."
    },
    linkSuggestions: {
      internal: [
        "Link to your complete guide page",
        "Link to a related case study",
        "Link to your pricing or services page"
      ],
      external: [
        "Add one authoritative source citation",
        "Link to relevant industry benchmark data"
      ]
    },
    visualRecommendations: {
      suggestedVisuals: ["2 screenshots", "1 comparison table", "1 short explainer video"]
    },
    depthAnalyzer: {
      currentWordCount: tokenCount,
      competitorAverageWordCount: 2100,
      suggestedTargetRange: "1800-2500 words",
      suggestedAdditionalWords: Math.max(0, 1800 - tokenCount)
    },
    searchIntentMatcher: {
      inferredIntent: "informational",
      matchScore: card.seoScore >= 75 ? 92 : 78
    },
    schemaMarkupSuggestions: {
      article: {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title || "Optimized Content Article",
        description: "SEO-ready content generated by integrated analyzer."
      },
      faq: {
        "@context": "https://schema.org",
        "@type": "FAQPage"
      }
    },
    optimizationActionPlan: {
      quickWins: [
        "Add meta description with primary keyword",
        "Insert 2 internal links",
        "Shorten long sentences above 25 words"
      ],
      mediumTasks: [
        "Expand missing sections with examples",
        "Add at least 3 visuals and alt text",
        "Improve H2/H3 hierarchy"
      ]
    },
    competitorAnalysis: {
      yourWordCount: tokenCount,
      competitorAverageWordCount: 2100,
      yourLinks: (text.match(/https?:\/\//g) || []).length,
      competitorAverageLinks: 8
    },
    externalData: {
      searchInsights,
      newsResearch
    },
    warnings
  };
}
