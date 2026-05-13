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

function extractJSON(text) {
  // Remove markdown code fences
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {}
  // Try to find JSON array/object in text
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try { return JSON.parse(arrayMatch[0]); } catch {}
  }
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch {}
  }
  throw new Error('Failed to extract JSON from: ' + cleaned.substring(0, 200));
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
          items = extractJSON(response);
        } catch {
          items = [];
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
          items = extractJSON(response);
        } catch {
          items = [];
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

async function filter(weekStr) {
  const rawPath = path.join(DATA_RAW, `${weekStr}.json`);
  if (!fs.existsSync(rawPath)) {
    console.error(`  [filter] Raw data not found: ${rawPath}`);
    process.exit(1);
  }
  const raw = readJSON(rawPath);
  const index = readJSON(INDEX_PATH) || { entries: {} };

  // Step 1: Dedup against index
  const newItems = raw.items.filter(item => !index.entries[item.url]);

  // Step 2: Score with DeepSeek
  const filtered = [];
  const batchSize = 5;
  for (let i = 0; i < newItems.length; i += batchSize) {
    const batch = newItems.slice(i, i + batchSize);
    const prompt = `Score each item on three dimensions (1-5). Be strict — most items are 2-3.

Items:
${JSON.stringify(batch, null, 2)}

Scoring criteria:
- practicality (1-5): Can this directly improve a workflow? Are there actionable steps?
- freshness (1-5): Is this new information, not widely known?
- credibility (1-5): Source authority, evidence quality

Return a JSON array of scores (same order as input):
[{"practicality": N, "freshness": N, "credibility": N, "reason": "one sentence"}]`;

    const response = await chat(
      'You score AI/tech content quality. Return only valid JSON array. No markdown.',
      prompt
    );
    try {
      const scores = extractJSON(response);
      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const score = scores[j] || { practicality: 1, freshness: 1, credibility: 1, reason: 'parse error' };
        const total = score.practicality + score.freshness + score.credibility;
        if (score.practicality >= 3 && score.freshness >= 2) {
          filtered.push({ ...item, scores: score, total_score: total });
          index.entries[item.url] = { week: weekStr, score: total };
        }
      }
    } catch (err) {
      console.error(`  [filter] Batch scoring failed at i=${i}: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // Sort by total score descending
  filtered.sort((a, b) => b.total_score - a.total_score);

  const filteredPath = path.join(DATA_FILTERED, `${weekStr}.json`);
  ensureDir(DATA_FILTERED);
  writeJSON(filteredPath, {
    week: weekStr,
    filtered_at: new Date().toISOString(),
    total_raw: raw.items.length,
    total_new: newItems.length,
    total_passed: filtered.length,
    items: filtered,
  });

  // Update index
  index.last_updated = new Date().toISOString();
  writeJSON(INDEX_PATH, index);

  console.log(`  [filter] ${raw.items.length} raw -> ${newItems.length} new -> ${filtered.length} passed -> ${filteredPath}`);
}

async function summarize(weekStr) {
  const filteredPath = path.join(DATA_FILTERED, `${weekStr}.json`);
  if (!fs.existsSync(filteredPath)) {
    console.error(`  [summarize] Filtered data not found: ${filteredPath}`);
    process.exit(1);
  }
  const filtered = readJSON(filteredPath);

  if (filtered.items.length === 0) {
    const weekNum = weekStr.split('-W')[1] || '??';
    const today = new Date().toISOString().split('T')[0];
    const emptyDigest = `# 第 ${weekNum} 周 AI Agent 使用技巧周报

**${today}**

## 本周无值得关注的新内容

所有采集到的新内容均未通过评分阈值筛选，或本周来源未产出 AI Agent 相关内容。

---
*Generated by Weekly Intel Pipeline*`;
    const reportDir = path.join(REPORTS, weekStr);
    ensureDir(reportDir);
    fs.writeFileSync(path.join(reportDir, 'digest.md'), emptyDigest, 'utf-8');
    console.log(`  [summarize] Empty week -> ${reportDir}/digest.md`);
    return;
  }

  // Group items by category
  const groups = { official: [], community: [], expert: [], ecosystem: [] };
  for (const item of filtered.items) {
    if (item.source?.toLowerCase().includes('anthropic') || item.type === 'official') {
      groups.official.push(item);
    } else if (item.source?.toLowerCase().includes('karpathy') || item.type === 'expert') {
      groups.expert.push(item);
    } else if (item.type === 'ecosystem' || item.source?.toLowerCase().includes('github')) {
      groups.ecosystem.push(item);
    } else {
      groups.community.push(item);
    }
  }

  const weekNum = weekStr.split('-W')[1] || '??';
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const range = `${monday.toISOString().split('T')[0]} ~ ${sunday.toISOString().split('T')[0]}`;

  const prompt = `Generate a detailed Chinese-language weekly digest from the following AI Agent / Claude Code intel items.

Week: ${weekNum} (${range})

## Official Updates
${JSON.stringify(groups.official.slice(0, 10))}

## Community & Practical Tips
${JSON.stringify(groups.community.slice(0, 15))}

## Expert Perspectives
${JSON.stringify(groups.expert.slice(0, 10))}

## Tools & Ecosystem
${JSON.stringify(groups.ecosystem.slice(0, 10))}

Write a Markdown digest in Chinese following this EXACT format. Keep original titles and links in English/Chinese as found. ALL links MUST be preserved as clickable Markdown [title](url).

# 第 ${weekNum} 周 AI Agent 使用技巧周报 (${range})

## 官方动态
For each item:
- **[title](url)** | 来源: source | date
  Detailed summary in Chinese (2-3 sentences) + Impact analysis: how this affects your Claude Code workflow

## 社区热帖 & 实战技巧
For each item:
- **[title](url)** | 来源: source | date
  Core insights + actionable steps you can take

## 行业专家观点
For each item:
- **[title](url)** | 来源: source | date
  Core argument + Takeaways for your practice

## 工具与生态
For each item:
- **Tool/Project Name** | 来源: source | date
  What problem it solves, whether worth trying

## 本周洞察
- 2-3 cross-cutting themes or patterns noticed across this week's content

---
*Generated by Weekly Intel Pipeline on ${today}*`;

  const digest = await chat(
    'You are a senior AI engineering researcher writing a weekly intelligence digest. Write in Chinese. Be detailed and practical — each item should have enough context for the reader to decide whether to act. Preserve ALL original links.',
    prompt
  );

  const reportDir = path.join(REPORTS, weekStr);
  ensureDir(reportDir);
  fs.writeFileSync(path.join(reportDir, 'digest.md'), digest, 'utf-8');
  console.log(`  [summarize] Digest written -> ${reportDir}/digest.md`);
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
