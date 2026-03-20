import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";

import { checkGrammar } from "./lib/grammar.js";
import { humanizeText } from "./lib/humanize.js";
import { integrationStatus } from "./lib/integrations.js";
import { checkPlagiarism } from "./lib/plagiarism.js";
import { analyzeSEO } from "./lib/seo.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);
const FRONTEND_URL = process.env.FRONTEND_URL || "*";

app.use(
  cors({
    origin: FRONTEND_URL === "*" ? true : FRONTEND_URL.split(","),
    credentials: true
  })
);
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "free-plagiarism-humanizer-backend" });
});

app.get("/api/integrations/status", (_req, res) => {
  res.json(integrationStatus());
});

app.get("/api/integrations/env-template", (_req, res) => {
  const status = integrationStatus();
  const lines = [];
  for (const item of status.integrations) {
    for (const env of item.env) {
      lines.push(`${env}=`);
    }
  }
  res.type("text/plain").send(lines.join("\n"));
});

app.post("/api/plagiarism", async (req, res) => {
  try {
    const text = String(req.body?.text || "");
    if (!text.trim()) {
      return res.status(400).json({ error: "Text is required." });
    }
    const result = await checkPlagiarism(text);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to check plagiarism.",
      details: error.message
    });
  }
});

app.post("/api/humanize", async (req, res) => {
  try {
    const text = String(req.body?.text || "");
    const intensity = Number(req.body?.intensity ?? 50);
    const versions = Number(req.body?.versions ?? 5);
    if (!text.trim()) {
      return res.status(400).json({ error: "Text is required." });
    }
    const result = await humanizeText(text, intensity, versions);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to humanize text.",
      details: error.message
    });
  }
});

app.post("/api/grammar/check", async (req, res) => {
  try {
    const text = String(req.body?.text || "");
    const language = String(req.body?.language || "en-US");
    if (!text.trim()) {
      return res.status(400).json({ error: "Text is required." });
    }
    const report = await checkGrammar(text, language);
    return res.json(report);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to run grammar check.",
      details: error.message
    });
  }
});

app.post("/api/seo/analyze", async (req, res) => {
  try {
    const text = String(req.body?.text || "");
    const title = String(req.body?.title || "");
    const keyword = String(req.body?.keyword || "");
    if (!text.trim()) {
      return res.status(400).json({ error: "Text is required." });
    }
    const report = await analyzeSEO({ text, title, keyword });
    return res.json(report);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to run SEO analysis.",
      details: error.message
    });
  }
});

app.post("/api/optimize", async (req, res) => {
  try {
    const text = String(req.body?.text || "");
    const title = String(req.body?.title || "");
    const keyword = String(req.body?.keyword || "");
    const intensity = Number(req.body?.intensity ?? 50);
    if (!text.trim()) {
      return res.status(400).json({ error: "Text is required." });
    }

    const [plagiarism, humanizer, seo, grammar] = await Promise.all([
      checkPlagiarism(text),
      humanizeText(text, intensity, 5),
      analyzeSEO({ text, title, keyword }),
      checkGrammar(text, "en-US")
    ]);

    const qualityScore = Math.round(
      plagiarism.breakdown.original * 0.4 +
        (100 - plagiarism.plagiarismPercentage) * 0.2 +
        seo.scoreBreakdown.readability * 0.15 +
        seo.scoreBreakdown.keywordOptimization * 0.15 +
        grammar.score * 0.1
    );

    return res.json({
      qualityScore,
      plagiarism,
      humanizer,
      seo,
      grammar
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to optimize content.",
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
