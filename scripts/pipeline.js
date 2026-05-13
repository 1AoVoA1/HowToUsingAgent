#!/usr/bin/env node
// scripts/pipeline.js — AI Agent Weekly Intel Pipeline
// Usage: node scripts/pipeline.js [collect|filter|summarize|all]

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// --- Config ---
const ROOT = path.resolve(__dirname, '..');
const DATA_RAW = path.join(ROOT, 'data', 'raw');
const DATA_FILTERED = path.join(ROOT, 'data', 'filtered');
const INDEX_PATH = path.join(ROOT, 'data', 'index.json');
const REPORTS = path.join(ROOT, 'reports');
const SOURCES_PATH = path.join(ROOT, 'config', 'sources.md');
const PIPELINE_CONFIG_PATH = path.join(ROOT, 'config', 'pipeline.md');

// DeepSeek client (OpenAI-compatible)
const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const MODEL = 'deepseek-chat';

// --- Helpers ---
function getWeekInfo() {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now - yearStart) / 86400000 + yearStart.getDay() + 1) / 7);
  const weekStr = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  return { weekStr, year: now.getFullYear(), weekNum };
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function chat(systemPrompt, userMessage) {
  const response = await deepseek.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.3,
    max_tokens: 4096,
  });
  return response.choices[0].message.content;
}

function readJSON(p) {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function writeJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
}

async function main() {
  const step = process.argv[2] || 'all';
  const { weekStr } = getWeekInfo();
  console.log(`[pipeline] Running for week ${weekStr}, step: ${step}`);

  if (step === 'collect' || step === 'all') {
    console.log('[pipeline] === COLLECT ===');
    await collect(weekStr);
  }
  if (step === 'filter' || step === 'all') {
    console.log('[pipeline] === FILTER ===');
    await filter(weekStr);
  }
  if (step === 'summarize' || step === 'all') {
    console.log('[pipeline] === SUMMARIZE ===');
    await summarize(weekStr);
  }
  console.log('[pipeline] Done.');
}

main().catch(err => {
  console.error('[pipeline] FATAL:', err.message);
  process.exit(1);
});
