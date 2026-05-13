# AI Agent 周度情报系统 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an automated weekly AI Agent intel pipeline that collects from global sources, filters/scoring, generates digest reports via GitHub Actions + DeepSeek API, and produces actionable Claude Code improvement suggestions locally.

**Architecture:** Node.js pipeline script (`scripts/pipeline.js`) using DeepSeek API (OpenAI-compatible) for LLM tasks, split into three stages: collection → filtering → summarization. Each stage reads from and writes to the filesystem. GitHub Actions triggers weekly, runs the pipeline, commits digest back to repo. Suggestion generation runs locally in Claude Code (has access to user's CLAUDE.md).

**Tech Stack:** Node.js (openai SDK pointed at DeepSeek), GitHub Actions, shell scripting

---

## File Structure

```
F:\ClaudeWork\HowToUsingAgent\
├── .github/workflows/
│   └── weekly-intel.yml         # CI workflow — cron trigger + pipeline run + commit
├── config/
│   ├── sources.md               # Source catalog with URLs and collection methods
│   └── pipeline.md              # Pipeline config: thresholds, limits, week number
├── scripts/
│   └── pipeline.js              # Main pipeline — collect → filter → summarize
├── data/
│   ├── raw/                     # Raw collection output per week (JSON)
│   ├── filtered/                # Filtered/scored content (JSON)
│   └── index.json               # Historical URL index for dedup
├── reports/
│   └── YYYY-WXX/                # Per-week report directory
│       └── digest.md             # Weekly digest (actions.md generated locally)
├── package.json                 # Node.js deps: openai, jsdom
├── memory.md                    # Project operation learnings
└── Readme.md                    # Setup and usage guide
```

**Boundary notes:**
- `scripts/pipeline.js` is the only executable code. It handles all 3 cloud stages via subcommands: `collect`, `filter`, `summarize`, `all`.
- The suggestion agent is NOT implemented in code — it's a Claude Code prompt the user runs locally.
- `config/pipeline.md` tracks the current ISO week number so the pipeline knows which week it's processing.

---

### Task 1: Initialize project structure

**Files:**
- Create: `package.json`
- Create: `data/raw/.gitkeep`
- Create: `data/filtered/.gitkeep`
- Create: `reports/.gitkeep`
- Create: `.gitignore`
- Modify: (none)

- [ ] **Step 1: Write package.json**

```json
{
  "name": "ai-agent-weekly-intel",
  "version": "1.0.0",
  "description": "Weekly AI Agent intel pipeline — collect, filter, summarize",
  "private": true,
  "scripts": {
    "pipeline": "node scripts/pipeline.js"
  },
  "dependencies": {
    "openai": "^4.73.0"
  }
}
```

- [ ] **Step 2: Write .gitignore**

```
node_modules/
.env
data/raw/
data/filtered/
```

- [ ] **Step 3: Create directories and .gitkeep files**

```bash
mkdir -p data/raw data/filtered reports
touch data/raw/.gitkeep data/filtered/.gitkeep reports/.gitkeep
```

- [ ] **Step 4: Install dependencies**

```bash
npm install
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore data/ reports/
git commit -m "chore: initialize project structure with npm deps"
```

---

### Task 2: Write initial data files

**Files:**
- Create: `config/sources.md`
- Create: `config/pipeline.md`
- Create: `data/index.json`

- [ ] **Step 1: Write config/sources.md — source catalog**

```markdown
# Information Sources

## Core (🔴)
- name: Anthropic Blog
  url: https://www.anthropic.com/research
  lang: en
  type: official
  method: webfetch
  priority: core
  last_verified: 2026-05-13

- name: Claude Docs Changelog
  url: https://docs.anthropic.com/en/release-notes
  lang: en
  type: official
  method: webfetch
  priority: core
  last_verified: 2026-05-13

- name: Reddit r/ClaudeAI
  url: https://www.reddit.com/r/ClaudeAI/top.json?t=week&limit=20
  lang: en
  type: community
  method: api
  priority: core
  last_verified: 2026-05-13

- name: Reddit r/AnthropicAI
  url: https://www.reddit.com/r/AnthropicAI/top.json?t=week&limit=20
  lang: en
  type: community
  method: api
  priority: core
  last_verified: 2026-05-13

- name: Reddit r/SaaS
  url: https://www.reddit.com/r/SaaS/top.json?t=week&limit=20
  lang: en
  type: community
  method: api
  priority: core
  last_verified: 2026-05-13

- name: X — Andrey Karpathy
  url: https://nitter.net/karpathy/search?f=tweets
  lang: en
  type: expert
  method: websearch
  priority: core
  last_verified: 2026-05-13

## Extended (🟡)
- name: Hacker News
  url: https://hacker-news.firebaseio.com/v0/topstories.json
  lang: en
  type: community
  method: api
  priority: extended
  last_verified: 2026-05-13

- name: X — Claude Code tips search
  query: "Claude Code tips OR tricks OR workflow 2026"
  lang: en
  type: social
  method: websearch
  priority: extended
  last_verified: 2026-05-13

- name: GitHub Trending — Claude tools
  url: https://github.com/trending?since=weekly
  lang: en
  type: ecosystem
  method: webfetch
  priority: extended
  last_verified: 2026-05-13

## Domestic (🟢)
- name: 知乎 — AI 话题
  query: "Claude AI Agent 使用技巧"
  lang: zh
  type: community
  method: websearch
  priority: domestic
  last_verified: 2026-05-13

- name: B站
  query: "Claude Code 教程 使用技巧"
  lang: zh
  type: video
  method: websearch
  priority: domestic
  last_verified: 2026-05-13
```

- [ ] **Step 2: Write config/pipeline.md**

```markdown
# Pipeline Configuration

- schedule: "0 1 * * 1" (UTC, = Beijing 9:00 Monday)
- items_per_source: 20
- scoring:
    practicality_threshold: 3
    freshness_threshold: 2
- suggestions_per_week: 5
- current_week: 2026-W20
```

- [ ] **Step 3: Write data/index.json**

```json
{
  "entries": {},
  "last_updated": "2026-05-13"
}
```

- [ ] **Step 4: Commit**

```bash
git add config/sources.md config/pipeline.md data/index.json
git commit -m "feat: add source catalog, pipeline config, and empty index"
```

---

### Task 3: Pipeline script — framework and DeepSeek client

**Files:**
- Create: `scripts/pipeline.js`

- [ ] **Step 1: Write the framework — argument parsing and main dispatcher**

```javascript
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
```

- [ ] **Step 2: Verify the framework runs without errors**

```bash
node scripts/pipeline.js --help 2>&1 || true  # should not crash, will print usage or run empty
```

Expected: Should print "Running for week ..." and exit cleanly (stages are stubs).

- [ ] **Step 3: Commit**

```bash
git add scripts/pipeline.js
git commit -m "feat: add pipeline framework with DeepSeek client and helpers"
```

---

### Task 4: Pipeline script — collection stage

**Files:**
- Modify: `scripts/pipeline.js` (add `collect` function and source parsing)

- [ ] **Step 1: Write the source parser and web fetch helpers**

Append before `main()`:

```javascript
// --- Source Parser ---
function parseSources(markdown) {
  const sources = [];
  const blocks = markdown.split(/\n- name:/);
  for (let i = 1; i < blocks.length; i++) {
    const block = '- name:' + blocks[i];
    const get = (key) => {
      const m = block.match(new RegExp(`^\\s*-\\s*${key}:\\s*(.+)$`, 'm'));
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
  // Simple tag stripping for non-JS-rendered pages
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 8000);
}
```

- [ ] **Step 2: Write the `collect` function**

Append before `main()`:

```javascript
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
        // Use DeepSeek as search synthesizer for sources without direct API
        const query = src.query || `latest ${src.name} AI agent Claude tips`;
        const prompt = `
Search topic: "${query}"
Source type: ${src.type}
Language: ${src.lang}

Find up to ${20} recent (this week or last week) articles, posts, or discussions about AI agent usage, Claude Code tips, or related topics from ${src.name}.

Return a JSON array. Each item: {"title": "...", "url": "...", "published": "ISO date", "source": "${src.name}", "author": "if known", "snippet": "1-2 sentence summary"}

Only include real, verifiable content. If you cannot find anything, return empty array [].`;
        const response = await chat(
          'You are a research assistant. Only return real content you are confident exists. Return valid JSON array. No markdown wrapper.',
          prompt
        );
        try {
          items = JSON.parse(response);
        } catch {
          // Try to extract JSON from response
          const match = response.match(/\[[\s\S]*\]/);
          items = match ? JSON.parse(match[0]) : [];
        }
      } else if (src.method === 'webfetch') {
        const html = await webFetch(src.url);
        const text = extractTextFromHTML(html);
        const prompt = `
Extract articles/posts from this page content about AI agents or Claude Code.
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

      // Normalize and add
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
```

- [ ] **Step 3: Verify collection stage with dry-run on one source**

```bash
node -e "
const { execSync } = require('child_process');
// Just verify the module loads and parseSources works
const fs = require('fs');
const sources = fs.readFileSync('config/sources.md', 'utf-8');
console.log('Sources file readable, length:', sources.length);
"
```

Expected: Prints source file length without errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/pipeline.js
git commit -m "feat: add collection stage — Reddit API, HN API, webfetch, websearch via DeepSeek"
```

---

### Task 5: Pipeline script — filtering stage

**Files:**
- Modify: `scripts/pipeline.js` (add `filter` function)

- [ ] **Step 1: Write the `filter` function**

Append before `main()`:

```javascript
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
      const scores = JSON.parse(response);
      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const score = scores[j] || { practicality: 1, freshness: 1, credibility: 1, reason: 'parse error' };
        const total = score.practicality + score.freshness + score.credibility;
        // Threshold: practicality >= 3 AND freshness >= 2
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
```

- [ ] **Step 2: Verify filtering on empty/sample data**

```bash
node -e "
const fs = require('fs');
// Test that the data/index.json is readable and well-formed
const idx = JSON.parse(fs.readFileSync('data/index.json', 'utf-8'));
console.log('Index loaded, entries:', Object.keys(idx.entries).length);
"
```

Expected: `Index loaded, entries: 0`

- [ ] **Step 3: Commit**

```bash
git add scripts/pipeline.js
git commit -m "feat: add filtering stage — dedup against index, 3D scoring via DeepSeek"
```

---

### Task 6: Pipeline script — summarization stage

**Files:**
- Modify: `scripts/pipeline.js` (add `summarize` function)

- [ ] **Step 1: Write the `summarize` function**

Append before `main()`:

```javascript
async function summarize(weekStr) {
  const filteredPath = path.join(DATA_FILTERED, `${weekStr}.json`);
  if (!fs.existsSync(filteredPath)) {
    console.error(`  [summarize] Filtered data not found: ${filteredPath}`);
    process.exit(1);
  }
  const filtered = readJSON(filteredPath);

  if (filtered.items.length === 0) {
    const emptyDigest = `# 第 ${filtered.week.replace('2026-W', '')} 周 AI Agent 使用技巧周报

**${new Date().toISOString().split('T')[0]}**

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

  const weekNum = filtered.week.split('-W')[1] || '??';
  const today = new Date().toISOString().split('T')[0];
  // Approximate week range
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
```

- [ ] **Step 2: Verify summarization on empty sample data**

```bash
node -e "
const fs = require('fs');
const path = require('path');
// Create minimal filtered data for testing
const testData = {
  week: '2026-W20',
  filtered_at: new Date().toISOString(),
  total_raw: 0, total_new: 0, total_passed: 0,
  items: []
};
const dir = path.join('data', 'filtered');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, '2026-W20.json'), JSON.stringify(testData));
console.log('Test data created');
"
```

- [ ] **Step 3: Run summarize on the empty test data**

```bash
node scripts/pipeline.js summarize
```

Expected: Creates `reports/2026-W20/digest.md` with "本周无值得关注的新内容" message.

- [ ] **Step 4: Clean up test data**

```bash
rm -f data/filtered/2026-W20.json reports/2026-W20/digest.md
```

- [ ] **Step 5: Commit**

```bash
git add scripts/pipeline.js
git commit -m "feat: add summarization stage — DeepSeek generates Chinese digest.md in structured format"
```

---

### Task 7: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/weekly-intel.yml`

- [ ] **Step 1: Write the workflow file**

```yaml
name: Weekly AI Agent Intel

on:
  schedule:
    - cron: '0 1 * * 1'  # Monday 1:00 UTC = Beijing 9:00
  workflow_dispatch:

jobs:
  pipeline:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run pipeline
        env:
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
        run: node scripts/pipeline.js all

      - name: Commit and push reports
        run: |
          git config user.name "weekly-intel-bot"
          git config user.email "bot@weekly-intel.local"
          git add reports/ data/index.json
          if git diff --staged --quiet; then
            echo "No changes to commit"
          else
            WEEK=$(date +%Y-W%V)
            git commit -m "report: week $WEEK intel digest"
            git push
          fi
```

- [ ] **Step 2: Verify workflow YAML syntax**

```bash
node -e "require('fs').readFileSync('.github/workflows/weekly-intel.yml', 'utf-8'); console.log('YAML file readable')"
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/weekly-intel.yml
git commit -m "feat: add GitHub Actions workflow — weekly cron + manual dispatch"
```

---

### Task 8: Create GitHub repo and push

**Files:**
- (none — this is a git/GitHub operation)

- [ ] **Step 1: Create GitHub repository**

```bash
gh repo create HowToUsingAgent --public --source=. --remote=origin --push
```

If `gh` is not authenticated, manually create at https://github.com/1AoVoA1/HowToUsingAgent then:

```bash
git remote add origin https://github.com/1AoVoA1/HowToUsingAgent.git
git branch -M main
git push -u origin main
```

- [ ] **Step 2: Verify remote is set**

```bash
git remote -v
```

Expected: Shows `https://github.com/1AoVoA1/HowToUsingAgent.git` for fetch and push.

---

### Task 9: Configure GitHub Secrets

**Files:**
- (none — GitHub web UI operation)

- [ ] **Step 1: Add DEEPSEEK_API_KEY secret**

Go to: https://github.com/1AoVoA1/HowToUsingAgent/settings/secrets/actions

Click "New repository secret":
- Name: `DEEPSEEK_API_KEY`
- Value: `sk-36fe197a562c40ac856f80a13c92bcf7`

- [ ] **Step 2: Verify secret is configured**

```bash
gh secret list --repo 1AoVoA1/HowToUsingAgent
```

Expected: Lists `DEEPSEEK_API_KEY` (value hidden).

---

### Task 10: Manual pipeline test

**Files:**
- (none — verification only)

- [ ] **Step 1: Trigger workflow manually**

```bash
gh workflow run weekly-intel.yml --repo 1AoVoA1/HowToUsingAgent
```

- [ ] **Step 2: Watch the run**

```bash
gh run watch --repo 1AoVoA1/HowToUsingAgent
```

- [ ] **Step 3: Check run status**

```bash
gh run list --repo 1AoVoA1/HowToUsingAgent --limit 3
```

Expected: Workflow completes successfully (green check).

- [ ] **Step 4: Pull the results locally**

```bash
git pull
ls -la reports/
```

Expected: New week directory with `digest.md`.

---

### Task 11: Write project documentation

**Files:**
- Create: `Readme.md`
- Create: `memory.md`

- [ ] **Step 1: Write Readme.md**

```markdown
# AI Agent 周度情报系统

每周自动采集全球 AI Agent 使用技巧与最佳实践，生成详细周报，产出 Claude Code 改进建议。

## 工作流

```
GitHub Actions (每周一 9:00 北京时间)
    ↓ 采集 → 过滤 → 摘要
    ↓ digest.md push 到仓库
本地
    ↓ git pull 获取周报
    ↓ 阅读 reports/YYYY-WXX/digest.md
    ↓ 在 Claude Code 中说"生成改进建议"
    ↓ 审阅 actions.md → 执行确认的改动
```

## 项目结构

```
├── .github/workflows/    # CI 定时触发
├── config/               # 信息源目录、流水线配置
├── scripts/              # 采集→过滤→摘要 流水线脚本
├── data/                 # 原始/过滤数据 + 去重索引
├── reports/              # 每周周报（digest.md）
├── memory.md             # 项目运行经验
└── Readme.md
```

## 本地使用

1. `git clone https://github.com/1AoVoA1/HowToUsingAgent.git`
2. `cd HowToUsingAgent && npm install`
3. 设置 `DEEPSEEK_API_KEY` 环境变量后，可手动运行：
   ```bash
   node scripts/pipeline.js all
   ```
4. 查看生成的周报：`reports/YYYY-WXX/digest.md`
5. 在 Claude Code 中说"根据本周 digest.md 生成改进建议"

## 配置

- 信息源：`config/sources.md`
- 流水线参数：`config/pipeline.md`
- GitHub Secrets：`DEEPSEEK_API_KEY`

## 维护

- 信息源由 Agent 定期维护更新
- 项目运行经验记录在 `memory.md`
```

- [ ] **Step 2: Write memory.md**

```markdown
# 项目记忆

## 初始设置
- 日期：2026-05-13
- 信息来源：Anthropic, Reddit (3 subs), X (Karpathy + search), HN, GitHub, 知乎, B站
- 执行环境：GitHub Actions (ubuntu-latest, Node.js 20)
- AI 模型：DeepSeek Chat API
- 定时：每周一 UTC 1:00 (北京时间 9:00)

## 已知问题与经验
- (初次运行后补充)
```

- [ ] **Step 3: Commit**

```bash
git add Readme.md memory.md
git commit -m "docs: add Readme.md and initial memory.md"
git push
```

---

### Task 12: Local suggestion agent prompt (manual — not automated)

**Files:**
- (none — this is a Claude Code prompt the user invokes locally)

- [ ] **Step 1: Document the suggestion agent prompt in memory.md**

Append to `memory.md`:

```markdown
## 建议 Agent 提示词（在 Claude Code 中本地执行）

每周 git pull 后，在 Claude Code 中说：

"读取本周的 reports/YYYY-WXX/digest.md，对比我当前的 CLAUDE.md 和 settings.json，
找出可以改进的地方，生成 actions.md。每轮上限 5 条，按投入产出比排序。
每条建议包含：现状、问题、改进方案（diff 级别）、风险等级、预计投入。"

## 采纳追踪
- (每周记录已执行建议及效果)
```

- [ ] **Step 2: Commit**

```bash
git add memory.md
git commit -m "docs: add suggestion agent prompt to memory.md"
git push
```
