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
