import { useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

const TABS = [
  { id: "plagiarism", label: "Plagiarism Checker" },
  { id: "humanizer", label: "Text Humanizer" },
  { id: "seo", label: "SEO Optimizer" }
];

function useAutoGrow() {
  return (event) => {
    const el = event.target;
    el.style.height = "auto";
    el.style.height = `${Math.max(220, el.scrollHeight)}px`;
  };
}

function DownloadButton({ filename, content, label }) {
  return (
    <button
      type="button"
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

function Progress({ value }) {
  const color = value <= 10 ? "green" : value <= 30 ? "yellow" : "red";
  return (
    <div className="progress-wrap">
      <div className="progress-track">
        <div className={`progress-value ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span>{value}%</span>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("plagiarism");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [keyword, setKeyword] = useState("");
  const [intensity, setIntensity] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const [plagiarismResult, setPlagiarismResult] = useState(null);
  const [humanizerResult, setHumanizerResult] = useState(null);
  const [seoResult, setSeoResult] = useState(null);
  const [optimizeResult, setOptimizeResult] = useState(null);

  const onGrow = useAutoGrow();
  const characters = useMemo(() => text.length, [text]);

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
    if (data) setPlagiarismResult(data);
  }

  async function runHumanizer() {
    const data = await callApi("/api/humanize", { text, intensity, versions: 5 });
    if (data) setHumanizerResult(data);
  }

  async function runSeo() {
    const data = await callApi("/api/seo/analyze", { text, title, keyword });
    if (data) setSeoResult(data);
  }

  async function runOptimize() {
    const data = await callApi("/api/optimize", { text, title, keyword, intensity });
    if (data) setOptimizeResult(data);
  }

  function copy(content, key) {
    navigator.clipboard.writeText(content);
    setCopied(key);
    setTimeout(() => setCopied(""), 1300);
  }

  return (
    <div className="app">
      <header>
        <h1>FREE PLAGIARISM CHECKER & HUMANIZER</h1>
        <p>No signup. No paid model required. PlagScan + Ollama ready.</p>
      </header>

      <div className="tabs">
        {TABS.map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? "tab active" : "tab"}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="panel">
        <label htmlFor="contentInput">Content</label>
        <textarea
          id="contentInput"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onInput={onGrow}
          placeholder="Paste your text here..."
        />
        <div className="meta-row">
          <span>Characters: {characters}/∞</span>
          <button className="ghost" onClick={runOptimize} disabled={loading || !text.trim()}>
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
                <label htmlFor="intensity">Humanization Intensity: {intensity}%</label>
                <input
                  id="intensity"
                  type="range"
                  min="0"
                  max="100"
                  value={intensity}
                  onChange={(event) => setIntensity(Number(event.target.value))}
                />
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

        {loading && <div className="loading">Processing...</div>}
        {error && <div className="error">{error}</div>}
      </section>

      <section className="panel">
        <h2>Results</h2>
        {tab === "plagiarism" && plagiarismResult && (
          <div className="result-block">
            <div className="headline-row">
              <strong>Plagiarism: {plagiarismResult.plagiarismPercentage}%</strong>
              <span>{plagiarismResult.status}</span>
            </div>
            <Progress value={plagiarismResult.plagiarismPercentage} />
            <div className="breakdown">
              <span>Exact: {plagiarismResult.breakdown?.exact ?? 0}%</span>
              <span>Paraphrased: {plagiarismResult.breakdown?.paraphrased ?? 0}%</span>
              <span>Partial: {plagiarismResult.breakdown?.partial ?? 0}%</span>
              <span>Original: {plagiarismResult.breakdown?.original ?? 0}%</span>
            </div>
            {plagiarismResult.warning && <div className="warn">{plagiarismResult.warning}</div>}
            <h3>Matching sources/phrases</h3>
            <ul className="source-list">
              {(plagiarismResult.matchingSources || []).length === 0 && <li>No matches found.</li>}
              {(plagiarismResult.matchingSources || []).map((item, idx) => (
                <li key={`${item.sourceUrl}-${idx}`}>
                  <div>
                    <strong>{item.matchType}</strong> | {item.credibility} | {item.sourceType}
                  </div>
                  <div>{item.phrase}</div>
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                    {item.sourceUrl}
                  </a>
                </li>
              ))}
            </ul>
            <div className="actions">
              <button
                onClick={() => copy(JSON.stringify(plagiarismResult, null, 2), "plagiarism")}
              >
                {copied === "plagiarism" ? "Copied!" : "Copy Result"}
              </button>
              <DownloadButton
                filename="plagiarism-report.txt"
                content={JSON.stringify(plagiarismResult, null, 2)}
                label="Download Result"
              />
            </div>
          </div>
        )}

        {tab === "humanizer" && humanizerResult && (
          <div className="result-block">
            {humanizerResult.warnings?.length > 0 && (
              <div className="warn">{humanizerResult.warnings[0]}</div>
            )}
            <div className="compare-grid">
              <div>
                <h3>Original</h3>
                <div className="text-card">{humanizerResult.originalText}</div>
              </div>
              <div>
                <h3>Humanized</h3>
                <div className="text-card">{humanizerResult.bestVersion?.text}</div>
              </div>
            </div>

            <h3>5 Versions</h3>
            <div className="versions">
              {(humanizerResult.versions || []).map((version) => (
                <article key={version.version} className="version-card">
                  <strong>Version {version.version}</strong>
                  <small>
                    Change: {version.diffStats.estimatedChangePercent}% | Provider: {version.provider}
                  </small>
                  <p>{version.text}</p>
                  <button onClick={() => copy(version.text, `v-${version.version}`)}>
                    {copied === `v-${version.version}` ? "Copied!" : "Copy"}
                  </button>
                </article>
              ))}
            </div>
            <div className="actions">
              <button
                onClick={() => copy(humanizerResult.bestVersion?.text || "", "humanized-best")}
              >
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
            <div className="breakdown">
              {Object.entries(seoResult.scoreBreakdown).map(([key, value]) => (
                <span key={key}>
                  {key}: {value}
                </span>
              ))}
            </div>
            <h3>Keyword Analyzer</h3>
            <p>
              Primary: <strong>{seoResult.keywordAnalyzer.primaryKeyword}</strong> | Density:{" "}
              {seoResult.keywordAnalyzer.density}%
            </p>
            <p>Related: {seoResult.keywordAnalyzer.relatedKeywords.join(", ")}</p>
            <h3>Meta Description Generator</h3>
            <ul>
              {seoResult.metaDescriptionGenerator.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <h3>Action Plan</h3>
            <ul>
              {seoResult.optimizationActionPlan.quickWins.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
        )}

        {optimizeResult && (
          <div className="result-block optimize">
            <h3>One-Click Optimization Summary</h3>
            <p>Quality Score: {optimizeResult.qualityScore}/100</p>
            <p>
              Plagiarism: {optimizeResult.plagiarism?.plagiarismPercentage}% | SEO:{" "}
              {optimizeResult.seo?.seoScore}/100
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
