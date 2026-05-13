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

// --- Source Parser ---
function parseSources(markdown) {
  const sources = [];
  const blocks = markdown.split(/\n- name:/);
  for (let i = 1; i < blocks.length; i++) {
    const block = '- name:' + blocks[i];
    const get = (key) => {
      const m = block.match(new RegExp(`^\\s*-?\\s*${key}:\\s*(.+)$`, 'm'));
      return m ? m[1].trim() : null;
    };
    sources.push({
      name: get('name'),
      url: get('url'),
      query: get('query'),
      lang: get('lang') || 'en',
      type: get('type') || 'unknown',
      method: get('method') || 'websearch',
      priority: get('priority') || 'extended',
    });
  }
  return sources;
}

async function fetchRedditJSON(url) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'WeeklyIntelBot/1.0' },
  });
  if (!resp.ok) throw new Error(`Reddit fetch failed: ${resp.status}`);
  const json = await resp.json();
  const posts = json.data?.children || [];
  return posts.map(p => ({
    title: p.data.title,
    url: `https://www.reddit.com${p.data.permalink}`,
    published: new Date(p.data.created_utc * 1000).toISOString(),
    source: 'Reddit',
    author: p.data.author,
    snippet: p.data.selftext?.substring(0, 500) || '',
    score: p.data.score,
  }));
}

async function fetchHNTopStories(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HN fetch failed: ${resp.status}`);
  const ids = await resp.json();
  const topIds = ids.slice(0, 30);
  const items = await Promise.all(
    topIds.map(async (id) => {
      const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
      if (!r.ok) return null;
      return r.json();
    })
  );
  return items.filter(Boolean).map(item => ({
    title: item.title,
    url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
    published: new Date(item.time * 1000).toISOString(),
    source: 'Hacker News',
    author: item.by,
    snippet: item.text?.substring(0, 500) || '',
    score: item.score,
  }));
}

async function webFetch(url) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'WeeklyIntelBot/1.0' },
  });
  if (!resp.ok) throw new Error(`Fetch ${url} failed: ${resp.status}`);
  return resp.text();
}

function extractTextFromHTML(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 8000);
}

async function collect(weekStr) {
  const sourcesMd = fs.readFileSync(SOURCES_PATH, 'utf-8');
  const sources = parseSources(sourcesMd);
  const rawPath = path.join(DATA_RAW, `${weekStr}.json`);
  const results = { week: weekStr, collected_at: new Date().toISOString(), items: [], _errors: [] };

  for (const src of sources) {
    console.log(`  [collect] ${src.name} (${src.method})`);
    try {
      let items = [];

      if (src.method === 'api' && src.url?.includes('reddit.com')) {
        items = await fetchRedditJSON(src.url);
      } else if (src.method === 'api' && src.url?.includes('hacker-news')) {
        items = await fetchHNTopStories(src.url);
      } else if (src.method === 'websearch') {
        const query = src.query || `latest ${src.name} AI agent Claude tips`;
        const prompt = `Search topic: "${query}"
Source type: ${src.type}
Language: ${src.lang}

Find up to 20 recent (this week or last week) articles, posts, or discussions about AI agent usage, Claude Code tips, or related topics from ${src.name}.

Return a JSON array. Each item: {"title": "...", "url": "...", "published": "ISO date", "source": "${src.name}", "author": "if known", "snippet": "1-2 sentence summary"}

Only include real, verifiable content. If you cannot find anything, return empty array [].`;
        const response = await chat(
          'You are a research assistant. Only return real content you are confident exists. Return valid JSON array. No markdown wrapper.',
          prompt
        );
        try {
          items = JSON.parse(response);
        } catch {
          const match = response.match(/\[[\s\S]*\]/);
          items = match ? JSON.parse(match[0]) : [];
        }
      } else if (src.method === 'webfetch') {
        const html = await webFetch(src.url);
        const text = extractTextFromHTML(html);
        const prompt = `Extract articles/posts from this page content about AI agents or Claude Code.
Source: ${src.name}
URL: ${src.url}

Page content (first 8000 chars):
${text}

Return a JSON array of items found. Each: {"title": "...", "url": "full URL if available", "published": "ISO date or null", "source": "${src.name}", "author": "...", "snippet": "1-2 sentence summary"}
Only include items from the LAST 7 DAYS. If none, return [].`;
        const response = await chat(
          'You parse web content into structured data. Return only valid JSON array.',
          prompt
        );
        try {
          items = JSON.parse(response);
        } catch {
          const match = response.match(/\[[\s\S]*\]/);
          items = match ? JSON.parse(match[0]) : [];
        }
      }

      for (const item of items) {
        if (item.title && item.url) {
          results.items.push({
            title: item.title,
            url: item.url,
            published: item.published || null,
            source: src.name,
            author: item.author || 'unknown',
            snippet: item.snippet || '',
            priority: src.priority,
            lang: src.lang,
          });
        }
      }
      console.log(`    -> ${items.length} items`);
    } catch (err) {
      console.error(`    [ERROR] ${src.name}: ${err.message}`);
      results._errors.push({ source: src.name, error: err.message });
    }

    // Rate limit between sources
    await new Promise(r => setTimeout(r, 1000));
  }

  ensureDir(DATA_RAW);
  writeJSON(rawPath, results);
  console.log(`  [collect] Total: ${results.items.length} items, ${results._errors.length} errors -> ${rawPath}`);
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
