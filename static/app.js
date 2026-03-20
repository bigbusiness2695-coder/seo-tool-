const el = (id) => document.getElementById(id);

const mainText = el("mainText");
const checkBtn = el("checkBtn");
const humanizeBtn = el("humanizeBtn");
const optimizeBtn = el("optimizeBtn");
const copyBtn = el("copyBtn");
const compareBtn = el("compareBtn");
const batchBtn = el("batchBtn");
const downloadCsvBtn = el("downloadCsvBtn");
const processingBar = el("processingBar");
const themeToggle = el("themeToggle");

let timelineChart;
let latestReport = null;
let latestHumanized = null;
let latestBatchCsv = "";

function debounce(fn, wait = 600) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

async function post(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || "Request failed");
  }
  return res;
}

function safeText(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderHighlights(text, segments) {
  if (!segments?.length) return safeText(text);
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  let cursor = 0;
  let html = "";
  for (const seg of sorted) {
    html += safeText(text.slice(cursor, seg.start));
    html += `<span class="${seg.match_type}" title="${safeText(seg.source_title)} (${safeText(
      seg.match_type
    )})">${safeText(text.slice(seg.start, seg.end))}</span>`;
    cursor = seg.end;
  }
  html += safeText(text.slice(cursor));
  return html;
}

function renderQuality(quality) {
  el("qualityOverall").textContent = quality?.overall ?? 0;
  const b = quality?.breakdown || {};
  el("qualityBreakdown").textContent = `Originality ${b.originality ?? 0} | Humanness ${
    b.humanness ?? 0
  } | Readability ${b.readability ?? 0} | Grammar ${b.grammar ?? 0}`;
}

function renderSources(sources) {
  const tbody = document.querySelector("#sourceTable tbody");
  tbody.innerHTML = "";
  for (const src of sources || []) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><a href="${safeText(src.url)}" target="_blank" rel="noreferrer">${safeText(src.title)}</a></td>
      <td>${safeText(src.source_type)}</td>
      <td>${safeText(src.credibility)} (${src.credibility_score})</td>
      <td>${safeText(src.matched_segments)}</td>`;
    tbody.appendChild(tr);
  }
}

function renderCitations(citations) {
  const list = el("citationList");
  list.innerHTML = "";
  for (const item of citations || []) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${safeText(item.title)}</strong><br/>MLA: ${safeText(
      item.mla
    )}<br/>APA: ${safeText(item.apa)}<br/>Chicago: ${safeText(item.chicago)}`;
    list.appendChild(li);
  }
}

function renderPlagiarism(report) {
  latestReport = report;
  el("exactPct").textContent = `${report.breakdown.exact}%`;
  el("paraPct").textContent = `${report.breakdown.paraphrased}%`;
  el("partialPct").textContent = `${report.breakdown.partial}%`;
  el("origPct").textContent = `${report.breakdown.original}%`;
  el("highlightedText").innerHTML = renderHighlights(mainText.value, report.segments);
  renderSources(report.matched_sources);
  renderCitations(report.citation_suggestions);
  renderQuality(report.content_quality_score);
}

function renderVersions(humanized) {
  latestHumanized = humanized;
  el("beforeText").textContent = humanized.before_after_comparison.before;
  el("afterText").textContent = humanized.best_version.text;
  const container = el("versions");
  container.innerHTML = "";
  humanized.versions.forEach((v) => {
    const div = document.createElement("div");
    div.className = "version-card";
    div.innerHTML = `
      <h4>Version ${v.version_id}</h4>
      <p><strong>Quality:</strong> ${v.content_quality_score.overall}</p>
      <p><strong>Originality:</strong> ${v.originality_after_humanization}%</p>
      <p><strong>AI:</strong> ${v.ai_generated_probability_after}%</p>
      <p><strong>Readability:</strong> ${v.readability_after.flesch}</p>
      <div class="output">${safeText(v.text)}</div>`;
    container.appendChild(div);
  });
}

async function refreshHistory() {
  const statsRes = await fetch("/api/history/stats");
  const stats = await statsRes.json();
  el("usageStats").innerHTML = `
    <li>Total checked: ${stats.total_content_checked}</li>
    <li>Average plagiarism: ${stats.average_plagiarism}%</li>
    <li>Humanized pieces: ${stats.content_humanized}</li>
    <li>Total words: ${stats.total_words_improved}</li>`;

  const timelineRes = await fetch("/api/history/timeline");
  const timeline = await timelineRes.json();
  const labels = timeline.points.map((p) => new Date(p.timestamp).toLocaleTimeString());
  const plag = timeline.points.map((p) => p.plagiarism);
  const ai = timeline.points.map((p) => p.ai_probability);
  const q = timeline.points.map((p) => p.quality_score);
  const ctx = document.getElementById("timelineChart").getContext("2d");
  if (timelineChart) timelineChart.destroy();
  timelineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Plagiarism %", data: plag, borderColor: "#ef4444", fill: false },
        { label: "AI %", data: ai, borderColor: "#f59e0b", fill: false },
        { label: "Quality", data: q, borderColor: "#2563eb", fill: false },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: { y: { beginAtZero: true, max: 100 } },
    },
  });
}

const realtimeCheck = debounce(async () => {
  const text = mainText.value.trim();
  if (text.length < 5) return;
  try {
    const res = await post("/api/realtime/analyze", { text });
    const data = await res.json();
    el("rtPlag").textContent = `${data.plagiarism_percentage}%`;
    el("rtAi").textContent = `${data.ai_generated_probability}%`;
    el("rtRead").textContent = data.readability;
    el("rtTips").innerHTML = (data.tips || []).map((t) => `<li>${safeText(t)}</li>`).join("");
  } catch (e) {
    // Keep live analyzer non-blocking.
  }
}, 700);

mainText.addEventListener("input", realtimeCheck);

checkBtn.addEventListener("click", async () => {
  const text = mainText.value.trim();
  if (text.length < 5) return alert("Please enter content first.");
  processingBar.classList.remove("hidden");
  try {
    const res = await post("/api/plagiarism/check", { text });
    const report = await res.json();
    renderPlagiarism(report);
    await refreshHistory();
  } catch (err) {
    alert(err.message);
  } finally {
    processingBar.classList.add("hidden");
  }
});

humanizeBtn.addEventListener("click", async () => {
  const text = mainText.value.trim();
  if (text.length < 5) return alert("Please enter content first.");
  const tone = el("toneSelect").value;
  const level = Number(el("levelSelect").value);
  const protect_phrases = el("protectPhrases")
    .value.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    const res = await post("/api/humanize", {
      text,
      tone,
      level,
      versions: 5,
      protect_phrases,
    });
    const data = await res.json();
    renderVersions(data);
    renderQuality(data.best_version.content_quality_score);
    await refreshHistory();
  } catch (err) {
    alert(err.message);
  }
});

optimizeBtn.addEventListener("click", async () => {
  const text = mainText.value.trim();
  if (text.length < 5) return alert("Please enter content first.");
  const tone = el("toneSelect").value;
  const level = Number(el("levelSelect").value);
  const protect_phrases = el("protectPhrases")
    .value.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    const res = await post("/api/optimize", { text, tone, level, protect_phrases });
    const data = await res.json();
    if (data.initial_report) renderPlagiarism(data.initial_report);
    if (data.humanized_report) renderVersions(data.humanized_report);
    await refreshHistory();
  } catch (err) {
    alert(err.message);
  }
});

compareBtn.addEventListener("click", async () => {
  const left_text = el("leftDoc").value.trim();
  const right_text = el("rightDoc").value.trim();
  if (left_text.length < 5 || right_text.length < 5) return alert("Provide both documents.");
  try {
    const res = await post("/api/plagiarism/compare", { left_text, right_text });
    const data = await res.json();
    el("compareOut").innerHTML = `<strong>Similarity:</strong> ${data.similarity_percentage}%<br/>${safeText(
      data.summary
    )}<br/><br/>${(data.matches || [])
      .slice(0, 12)
      .map(
        (m) =>
          `<div><em>${safeText(m.left_sentence)}</em><br/><strong>↔</strong> ${safeText(
            m.right_sentence
          )} (${m.similarity}%)</div>`
      )
      .join("<hr/>")}`;
  } catch (err) {
    alert(err.message);
  }
});

batchBtn.addEventListener("click", async () => {
  const raw = el("batchText").value.trim();
  if (!raw) return alert("Add batch documents first.");
  const documents = raw
    .split("\n---\n")
    .map((text, i) => ({ document_id: `batch-${i + 1}`, title: `Batch ${i + 1}`, text: text.trim() }))
    .filter((d) => d.text.length >= 5);
  if (!documents.length) return alert("No valid documents found.");
  try {
    const res = await post("/api/plagiarism/batch", { documents });
    const data = await res.json();
    latestBatchCsv = data.csv_export || "";
    el("batchOut").innerHTML = data.results
      .map(
        (r) =>
          `<div><strong>${safeText(r.title)}</strong> → Plagiarism ${r.plagiarism_percentage}%, Originality ${r.originality}%, AI ${r.ai_generated_probability}%</div>`
      )
      .join("");
  } catch (err) {
    alert(err.message);
  }
});

downloadCsvBtn.addEventListener("click", () => {
  if (!latestBatchCsv) return alert("Run batch check first.");
  const blob = new Blob([latestBatchCsv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "batch-plagiarism-results.csv";
  a.click();
  URL.revokeObjectURL(url);
});

copyBtn.addEventListener("click", async () => {
  const text = latestHumanized?.best_version?.text || el("afterText").textContent || "";
  if (!text) return alert("No output to copy yet.");
  await navigator.clipboard.writeText(text);
  alert("Copied to clipboard.");
});

document.querySelectorAll(".exportBtn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const export_format = btn.getAttribute("data-format");
    const report =
      latestReport ||
      (latestHumanized
        ? {
            breakdown: {
              exact: 0,
              paraphrased: 0,
              partial: 0,
              original: latestHumanized.best_version.originality_after_humanization,
            },
            ai_generated_probability: latestHumanized.best_version.ai_generated_probability_after,
            content_quality_score: latestHumanized.best_version.content_quality_score,
            matched_sources: [],
          }
        : null);
    if (!report) return alert("Run analysis first before exporting.");
    const payload = {
      export_format,
      filename: "originality-report",
      report,
      humanized_text: latestHumanized?.best_version?.text || null,
    };
    const res = await post("/api/export", payload);
    if (export_format === "google_docs") {
      const data = await res.json();
      el("exportOut").innerHTML = `Google Docs Link: <a href="${data.google_docs_link}" target="_blank">${data.google_docs_link}</a>`;
      return;
    }
    const blob = await res.blob();
    const ext = export_format;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `originality-report.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    el("exportOut").textContent = `Downloaded ${ext.toUpperCase()} report.`;
  });
});

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
});

refreshHistory();
