import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const HISTORY_KEY = "content-tool-history-v2";

const TABS = [
  { id: "plagiarism", label: "Plagiarism", icon: "🛡️" },
  { id: "humanizer", label: "Humanizer", icon: "✨" },
  { id: "seo", label: "SEO", icon: "📈" }
];

function useAutoGrow() {
  return (event) => {
    const el = event.target;
    el.style.height = "auto";
    el.style.height = `${Math.max(220, el.scrollHeight)}px`;
  };
}

function scoreTone(value) {
  if (value >= 80) return "good";
  if (value >= 60) return "warn";
  return "bad";
}

function DownloadButton({ filename, content, label, variant = "secondary" }) {
  return (
    <button
      type="button"
      className={variant}
      onClick={() => {
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      {label}
    </button>
  );
}

function Gauge({ value = 0, label = "Score", inverse = false }) {
  const normalized = Math.max(0, Math.min(100, Number(value) || 0));
  const display = inverse ? 100 - normalized : normalized;
  const tone = scoreTone(display);
  const angle = (display / 100) * 360;
  return (
    <div className="gauge-wrap">
      <div
        className={`gauge ${tone}`}
        style={{ background: `conic-gradient(var(--ringColor) ${angle}deg, var(--ringTrack) 0deg)` }}
      >
        <div className="gauge-center">
          <strong>{display}</strong>
          <span>{label}</span>
        </div>
      </div>
    </div>
  );
}

function Progress({ value, inverse = false, label }) {
  const normalized = Math.max(0, Math.min(100, Number(value) || 0));
  const display = inverse ? 100 - normalized : normalized;
  const tone = scoreTone(display);
  return (
    <div className="progress-wrap">
      <div className="progress-label">
        <span>{label}</span>
        <strong>{display}%</strong>
      </div>
      <div className="progress-track">
        <div className={`progress-value ${tone}`} style={{ width: `${display}%` }} />
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="skeleton">
      <span />
      <span />
      <span />
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("plagiarism");
  const [theme, setTheme] = useState("dark");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [keyword, setKeyword] = useState("");
  const [intensity, setIntensity] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [history, setHistory] = useState([]);

  const [plagiarismResult, setPlagiarismResult] = useState(null);
  const [humanizerResult, setHumanizerResult] = useState(null);
  const [seoResult, setSeoResult] = useState(null);
  const [optimizeResult, setOptimizeResult] = useState(null);

  const onGrow = useAutoGrow();
  const characters = useMemo(() => text.length, [text]);

  useEffect(() => {
    const preferLight = window.matchMedia?.("(prefers-color-scheme: light)")?.matches;
    setTheme(preferLight ? "light" : "dark");
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      // Ignore malformed cache.
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  function pushHistory(entry) {
    const next = [{ ...entry, at: new Date().toISOString() }, ...history].slice(0, 8);
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }

  async function callApi(path, payload) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Request failed");
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function runPlagiarism() {
    const data = await callApi("/api/plagiarism", { text });
    if (!data) return;
    setPlagiarismResult(data);
    pushHistory({ type: "Plagiarism", score: `${data.plagiarismPercentage}%`, chars: characters });
  }

  async function runHumanizer() {
    const data = await callApi("/api/humanize", { text, intensity, versions: 5 });
    if (!data) return;
    setHumanizerResult(data);
    pushHistory({
      type: "Humanizer",
      score: `${data.bestVersion?.diffStats?.estimatedChangePercent ?? 0}% change`,
      chars: characters
    });
  }

  async function runSeo() {
    const data = await callApi("/api/seo/analyze", { text, title, keyword });
    if (!data) return;
    setSeoResult(data);
    pushHistory({ type: "SEO", score: `${data.seoScore}/100`, chars: characters });
  }

  async function runOptimize() {
    const data = await callApi("/api/optimize", { text, title, keyword, intensity });
    if (!data) return;
    setOptimizeResult(data);
    pushHistory({ type: "Optimize", score: `${data.qualityScore}/100`, chars: characters });
  }

  async function copy(content, key) {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(key);
      setTimeout(() => setCopied(""), 1300);
    } catch {
      setError("Copy failed. Please copy manually.");
    }
  }

  const statusTone = useMemo(() => {
    if (!plagiarismResult) return "good";
    const score = 100 - Number(plagiarismResult.plagiarismPercentage || 0);
    return scoreTone(score);
  }, [plagiarismResult]);

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-main">
          <p className="eyebrow">Advanced Originality Workspace</p>
          <h1>Free Plagiarism Checker, Humanizer & SEO Optimizer</h1>
          <p className="hero-sub">
            Premium UI workflow with one-click optimization, rich analytics, and no login required.
          </p>
          <div className="badge-row">
            <span className="badge">PlagScan API Ready</span>
            <span className="badge">Ollama Local Ready</span>
            <span className="badge">SEO Module Included</span>
          </div>
        </div>
        <button
          className="secondary theme-toggle"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          Theme: {theme === "dark" ? "Dark" : "Light"}
        </button>
      </header>

      <div className="layout">
        <main className="main-column">
          <section className="card editor-card">
            <div className="tab-row" role="tablist" aria-label="Tool tabs">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  className={tab === item.id ? "tab active" : "tab"}
                  onClick={() => setTab(item.id)}
                  role="tab"
                  aria-selected={tab === item.id}
                >
                  <span>{item.icon}</span> {item.label}
                </button>
              ))}
            </div>

            <label htmlFor="contentInput" className="label">
              Content Input
            </label>
            <textarea
              id="contentInput"
              value={text}
              onChange={(event) => setText(event.target.value)}
              onInput={onGrow}
              placeholder="Paste your text here for plagiarism checks, humanization, and SEO optimization..."
            />

            <div className="meta-row">
              <div className="chip-group">
                <span className="chip">Characters: {characters}/∞</span>
                <span className={`chip tone-${statusTone}`}>
                  {plagiarismResult ? plagiarismResult.status : "Ready"}
                </span>
              </div>
              <button className="secondary" onClick={runOptimize} disabled={loading || !text.trim()}>
                One-Click Optimize
              </button>
            </div>

            <div className="controls">
              {tab === "plagiarism" && (
                <button onClick={runPlagiarism} disabled={loading || !text.trim()}>
                  Check Plagiarism
                </button>
              )}

              {tab === "humanizer" && (
                <>
                  <div className="range-wrap">
                    <div className="range-top">
                      <label htmlFor="intensity">Humanization Intensity</label>
                      <strong>{intensity}%</strong>
                    </div>
                    <input
                      id="intensity"
                      type="range"
                      min="0"
                      max="100"
                      value={intensity}
                      onChange={(event) => setIntensity(Number(event.target.value))}
                    />
                    <div className="preset-row">
                      {[20, 40, 60, 80, 100].map((val) => (
                        <button
                          key={val}
                          className={intensity === val ? "mini active" : "mini"}
                          type="button"
                          onClick={() => setIntensity(val)}
                        >
                          {val}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={runHumanizer} disabled={loading || !text.trim()}>
                    Humanize Text
                  </button>
                </>
              )}

              {tab === "seo" && (
                <>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Optional title/headline"
                  />
                  <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="Optional primary keyword"
                  />
                  <button onClick={runSeo} disabled={loading || !text.trim()}>
                    Analyze SEO
                  </button>
                </>
              )}
            </div>

            {loading && (
              <div className="loading">
                <span>Processing request...</span>
                <Skeleton />
              </div>
            )}
            {error && <div className="error">{error}</div>}
          </section>

          <section className="card result-card">
            <div className="section-head">
              <h2>Results</h2>
              <span>Live analysis output</span>
            </div>

            {tab === "plagiarism" && plagiarismResult && (
              <div className="result-block">
                <div className="headline-row">
                  <strong>Plagiarism Score</strong>
                  <span className={`chip tone-${statusTone}`}>
                    {plagiarismResult.plagiarismPercentage}% • {plagiarismResult.status}
                  </span>
                </div>
                <Progress value={plagiarismResult.plagiarismPercentage} inverse label="Originality Confidence" />
                <div className="breakdown">
                  <span>Exact: {plagiarismResult.breakdown?.exact ?? 0}%</span>
                  <span>Paraphrased: {plagiarismResult.breakdown?.paraphrased ?? 0}%</span>
                  <span>Partial: {plagiarismResult.breakdown?.partial ?? 0}%</span>
                  <span>Original: {plagiarismResult.breakdown?.original ?? 0}%</span>
                </div>
                {plagiarismResult.warning && <div className="warn">{plagiarismResult.warning}</div>}
                <h3>Matching Sources</h3>
                <ul className="source-list">
                  {(plagiarismResult.matchingSources || []).length === 0 && <li>No matches found.</li>}
                  {(plagiarismResult.matchingSources || []).map((item, idx) => (
                    <li key={`${item.sourceUrl}-${idx}`}>
                      <div className="source-top">
                        <strong>{item.matchType}</strong>
                        <span>{item.credibility}</span>
                        <span>{item.sourceType}</span>
                      </div>
                      <p>{item.phrase}</p>
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                        {item.sourceUrl}
                      </a>
                    </li>
                  ))}
                </ul>
                <div className="actions">
                  <button
                    className="secondary"
                    onClick={() => copy(JSON.stringify(plagiarismResult, null, 2), "plagiarism")}
                  >
                    {copied === "plagiarism" ? "Copied!" : "Copy Result"}
                  </button>
                  <DownloadButton
                    filename="plagiarism-report.txt"
                    content={JSON.stringify(plagiarismResult, null, 2)}
                    label="Download Report"
                  />
                </div>
              </div>
            )}

            {tab === "humanizer" && humanizerResult && (
              <div className="result-block">
                {humanizerResult.warnings?.length > 0 && <div className="warn">{humanizerResult.warnings[0]}</div>}
                <div className="compare-grid">
                  <div>
                    <h3>Original</h3>
                    <div className="text-card">{humanizerResult.originalText}</div>
                  </div>
                  <div>
                    <h3>Best Humanized</h3>
                    <div className="text-card">{humanizerResult.bestVersion?.text}</div>
                  </div>
                </div>

                <h3>All Versions</h3>
                <div className="versions">
                  {(humanizerResult.versions || []).map((version) => (
                    <article key={version.version} className="version-card">
                      <div className="version-top">
                        <strong>Version {version.version}</strong>
                        <span>{version.provider}</span>
                      </div>
                      <small>Estimated rewrite: {version.diffStats.estimatedChangePercent}%</small>
                      <p>{version.text}</p>
                      <button className="secondary" onClick={() => copy(version.text, `v-${version.version}`)}>
                        {copied === `v-${version.version}` ? "Copied!" : "Copy"}
                      </button>
                    </article>
                  ))}
                </div>
                <div className="actions">
                  <button className="secondary" onClick={() => copy(humanizerResult.bestVersion?.text || "", "humanized-best")}>
                    {copied === "humanized-best" ? "Copied!" : "Copy Best Version"}
                  </button>
                  <DownloadButton
                    filename="humanized-text.txt"
                    content={humanizerResult.bestVersion?.text || ""}
                    label="Download .txt"
                  />
                </div>
              </div>
            )}

            {tab === "seo" && seoResult && (
              <div className="result-block">
                <div className="headline-row">
                  <strong>SEO Score: {seoResult.seoScore}/100</strong>
                  <span>{seoResult.readabilityAnalyzer.readingTimeMinutes} min read</span>
                </div>
                <div className="breakdown rich">
                  {Object.entries(seoResult.scoreBreakdown).map(([key, value]) => (
                    <span key={key}>
                      <strong>{key}</strong>
                      <em>{value}</em>
                    </span>
                  ))}
                </div>
                <h3>Keyword Strategy</h3>
                <p>
                  Primary keyword: <strong>{seoResult.keywordAnalyzer.primaryKeyword}</strong> • Density:{" "}
                  {seoResult.keywordAnalyzer.density}%
                </p>
                <p>Related: {seoResult.keywordAnalyzer.relatedKeywords.join(", ")}</p>
                <h3>Meta Description Suggestions</h3>
                <ul>
                  {seoResult.metaDescriptionGenerator.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
                <h3>Quick Action Plan</h3>
                <ul>
                  {seoResult.optimizationActionPlan.quickWins.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            )}

            {optimizeResult && (
              <div className="result-block optimize">
                <h3>Optimization Summary</h3>
                <div className="opt-grid">
                  <span>Quality Score: {optimizeResult.qualityScore}/100</span>
                  <span>Plagiarism: {optimizeResult.plagiarism?.plagiarismPercentage}%</span>
                  <span>SEO Score: {optimizeResult.seo?.seoScore}/100</span>
                </div>
              </div>
            )}
          </section>
        </main>

        <aside className="side-column">
          <section className="card">
            <h3>Live Quality Dashboard</h3>
            <div className="gauge-grid">
              <Gauge value={plagiarismResult?.plagiarismPercentage ?? 0} label="Originality" inverse />
              <Gauge value={seoResult?.seoScore ?? optimizeResult?.seo?.seoScore ?? 0} label="SEO" />
            </div>
            <Progress
              value={optimizeResult?.qualityScore ?? seoResult?.seoScore ?? 0}
              label="Overall Content Quality"
            />
          </section>

          <section className="card">
            <h3>Recent Activity</h3>
            {history.length === 0 ? (
              <p className="muted">No history yet. Run your first analysis.</p>
            ) : (
              <ul className="history-list">
                {history.map((item, idx) => (
                  <li key={`${item.at}-${idx}`}>
                    <div>
                      <strong>{item.type}</strong>
                      <span>{item.score}</span>
                    </div>
                    <small>
                      {new Date(item.at).toLocaleTimeString()} • {item.chars} chars
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h3>Smart Suggestions</h3>
            <ul className="tips">
              <li>Keep sentence length around 12-20 words for readability.</li>
              <li>Use protected terms when humanizing brand or product names.</li>
              <li>Add one external citation for every major claim.</li>
              <li>Aim for SEO score 80+ before publishing.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
