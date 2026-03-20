const INTEGRATIONS = [
  {
    id: "plagscan",
    category: "plagiarism",
    label: "PlagScan",
    env: ["PLAGSCAN_API_KEY"],
    required: true
  },
  {
    id: "copyscape",
    category: "plagiarism",
    label: "Copyscape",
    env: ["COPYSCAPE_USERNAME", "COPYSCAPE_API_KEY"],
    required: false
  },
  {
    id: "turnitin",
    category: "plagiarism",
    label: "Turnitin",
    env: ["TURNITIN_API_KEY", "TURNITIN_API_SECRET"],
    required: false
  },
  {
    id: "quetext",
    category: "plagiarism",
    label: "Quetext",
    env: ["QUETEXT_API_KEY"],
    required: false
  },
  {
    id: "unicheck",
    category: "plagiarism",
    label: "Unicheck",
    env: ["UNICHECK_CLIENT_ID", "UNICHECK_CLIENT_SECRET"],
    required: false
  },
  {
    id: "ollama",
    category: "humanizer",
    label: "Ollama",
    env: ["OLLAMA_URL", "OLLAMA_MODEL"],
    required: true
  },
  {
    id: "cohere",
    category: "humanizer",
    label: "Cohere",
    env: ["COHERE_API_KEY"],
    required: false
  },
  {
    id: "huggingface",
    category: "humanizer",
    label: "HuggingFace",
    env: ["HUGGINGFACE_API_KEY", "HUGGINGFACE_MODEL"],
    required: false
  },
  {
    id: "openai",
    category: "humanizer",
    label: "OpenAI",
    env: ["OPENAI_API_KEY"],
    required: false
  },
  {
    id: "claude",
    category: "humanizer",
    label: "Anthropic Claude",
    env: ["CLAUDE_API_KEY"],
    required: false
  },
  {
    id: "languagetool",
    category: "grammar",
    label: "LanguageTool",
    env: ["LANGUAGETOOL_URL"],
    required: true
  },
  {
    id: "grammarly",
    category: "grammar",
    label: "Grammarly",
    env: ["GRAMMARLY_CLIENT_ID", "GRAMMARLY_CLIENT_SECRET"],
    required: false
  },
  {
    id: "google-custom-search",
    category: "seo",
    label: "Google Custom Search",
    env: ["GOOGLE_SEARCH_API_KEY", "GOOGLE_SEARCH_ENGINE_ID"],
    required: true
  },
  {
    id: "moz",
    category: "seo",
    label: "Moz",
    env: ["MOZ_ACCESS_ID", "MOZ_SECRET_KEY"],
    required: false
  },
  {
    id: "semrush",
    category: "seo",
    label: "Semrush",
    env: ["SEMRUSH_API_KEY"],
    required: false
  },
  {
    id: "gsc",
    category: "seo",
    label: "Google Search Console",
    env: ["GOOGLE_SEARCH_CONSOLE_CREDENTIALS"],
    required: false
  },
  {
    id: "ahrefs",
    category: "seo",
    label: "Ahrefs",
    env: ["AHREFS_API_KEY"],
    required: false
  },
  {
    id: "gtmetrix",
    category: "seo",
    label: "GTmetrix",
    env: ["GTMETRIX_API_KEY"],
    required: false
  },
  {
    id: "wikipedia",
    category: "content",
    label: "Wikipedia",
    env: ["WIKIPEDIA_API_URL"],
    required: false
  },
  {
    id: "wiktionary",
    category: "content",
    label: "Wiktionary",
    env: ["WIKTIONARY_API_URL"],
    required: false
  },
  {
    id: "wordnik",
    category: "content",
    label: "Wordnik",
    env: ["WORDNIK_API_KEY"],
    required: false
  },
  {
    id: "merriam-webster",
    category: "content",
    label: "Merriam-Webster",
    env: ["MERRIAM_WEBSTER_API_KEY"],
    required: false
  },
  {
    id: "datamuse",
    category: "content",
    label: "Datamuse",
    env: ["DATAMUSE_API_URL"],
    required: false
  },
  {
    id: "google-nlp",
    category: "analysis",
    label: "Google Natural Language",
    env: ["GOOGLE_NLP_KEY_FILE"],
    required: false
  },
  {
    id: "azure-language",
    category: "analysis",
    label: "Azure Text Analytics",
    env: ["AZURE_LANGUAGE_KEY", "AZURE_LANGUAGE_ENDPOINT"],
    required: false
  },
  {
    id: "textrazor",
    category: "analysis",
    label: "TextRazor",
    env: ["TEXTRAZOR_API_KEY"],
    required: false
  },
  {
    id: "rapidapi",
    category: "data",
    label: "RapidAPI",
    env: ["RAPIDAPI_KEY"],
    required: false
  },
  {
    id: "newsapi",
    category: "data",
    label: "NewsAPI",
    env: ["NEWSAPI_KEY"],
    required: false
  },
  {
    id: "firebase",
    category: "storage",
    label: "Firebase",
    env: ["FIREBASE_API_KEY", "FIREBASE_PROJECT_ID"],
    required: false
  },
  {
    id: "mongodb",
    category: "storage",
    label: "MongoDB Atlas",
    env: ["MONGODB_URI"],
    required: false
  },
  {
    id: "supabase",
    category: "storage",
    label: "Supabase",
    env: ["SUPABASE_URL", "SUPABASE_KEY"],
    required: false
  },
  {
    id: "sendgrid",
    category: "notify",
    label: "SendGrid",
    env: ["SENDGRID_API_KEY"],
    required: false
  },
  {
    id: "mailgun",
    category: "notify",
    label: "Mailgun",
    env: ["MAILGUN_API_KEY", "MAILGUN_DOMAIN"],
    required: false
  },
  {
    id: "ip-api",
    category: "utility",
    label: "IP-API",
    env: ["IP_API_URL"],
    required: false
  },
  {
    id: "timezonedb",
    category: "utility",
    label: "TimeZoneDB",
    env: ["TIMEZONEDB_API_KEY"],
    required: false
  },
  {
    id: "auth0",
    category: "auth",
    label: "Auth0",
    env: ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET"],
    required: false
  }
];

function hasValue(name) {
  const value = process.env[name];
  return Boolean(value && String(value).trim().length > 0);
}

export function envConfigured(...envNames) {
  return envNames.every((name) => hasValue(name));
}

export function integrationStatus() {
  const entries = INTEGRATIONS.map((integration) => {
    const configured = envConfigured(...integration.env);
    return {
      ...integration,
      configured,
      missingEnv: integration.env.filter((e) => !hasValue(e))
    };
  });

  const categorySummary = entries.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = { configured: 0, total: 0 };
    }
    acc[item.category].total += 1;
    if (item.configured) acc[item.category].configured += 1;
    return acc;
  }, {});

  const requiredTotal = entries.filter((x) => x.required).length;
  const requiredReady = entries.filter((x) => x.required && x.configured).length;

  return {
    requiredReady,
    requiredTotal,
    readinessPercent: Math.round((requiredReady / Math.max(requiredTotal, 1)) * 100),
    categories: categorySummary,
    integrations: entries
  };
}

export function integrationMap() {
  const status = integrationStatus();
  const map = {};
  for (const item of status.integrations) {
    map[item.id] = item.configured;
  }
  return map;
}
