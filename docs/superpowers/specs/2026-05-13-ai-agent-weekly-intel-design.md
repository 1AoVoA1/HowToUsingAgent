# AI Agent 周度情报系统 — 设计文档

**日期**: 2026-05-13  
**状态**: 已确认

---

## 一、项目目标

每周自动采集国内外 AI Agent 使用技巧与最佳实践 → 过滤去重评分 → 生成详细周报 → 产出可执行的 Claude Code 改进建议 → 用户确认后自动执行改进。

## 二、信息源

### 国际（主力）

| 优先级 | 来源 | 关注点 |
|--------|------|--------|
| 🔴 核心 | Anthropic Blog / Claude Docs changelog | 官方更新、新功能、最佳实践 |
| 🔴 核心 | Reddit r/ClaudeAI, r/AnthropicAI, r/SaaS | 实战技巧、工作流分享、SaaS 场景下的 Agent 用法 |
| 🔴 核心 | X — Andrey Karpathy 等行业专家 | 方法论、前沿用法、思维框架 |
| 🟡 扩展 | Hacker News | 高热度 AI/Agent 讨论 |
| 🟡 扩展 | X — "Claude Code tips" 等关键词搜索 | 长尾技巧与社区发现 |
| 🟡 扩展 | GitHub trending / Awesome Claude lists | 工具与 MCP 生态更新 |

### 国内（辅助）

| 优先级 | 来源 | 关注点 |
|--------|------|--------|
| 🟢 国内 | 知乎 AI 话题 | 中文社区讨论 |
| 🟢 国内 | B站 筛选UP主 | 视频教程/演示 |

## 三、项目结构

```
F:\ClaudeWork\HowToUsingAgent\
├── .github/workflows/
│   └── weekly-intel.yml     # GitHub Actions 定时触发配置
├── config/
│   ├── sources.md           # 信息源完整目录（Agent 维护更新）
│   └── pipeline.md          # 流水线配置（频率、阈值等）
├── scripts/
│   └── pipeline.sh          # 流水线入口脚本（依次调用各 Agent）
├── data/
│   ├── raw/                 # 原始采集结果 JSON
│   ├── filtered/            # 过滤去重后 JSON
│   └── index.json           # 历史内容索引（去重依据）
├── reports/
│   └── YYYY-WXX/            # ISO 周号目录
│       ├── digest.md         # 本周详细摘要
│       └── actions.md        # 改进建议
├── memory.md                # 项目运行经验积累
└── Readme.md                # 项目说明与使用指南
```

## 四、流水线架构

流水线分为**云端执行**（GitHub Actions）和**本地执行**（Claude Code）两段，文件系统是它们的交接面。

### 云端段：GitHub Actions（周一 9:00 自动触发）

运行环境为 GitHub Actions ubuntu-latest，使用 Claude Code CLI + DeepSeek API 作为 Agent 引擎。

#### 1. 采集 Agent

- **输入**：`config/sources.md`（仓库内文件）
- **行为**：
  - 逐个来源采集，WebSearch（社区/博客/社交平台），WebFetch（官方文档、公告）
  - 每条内容提取：标题、链接、发布时间、来源、作者
  - 每来源上限 20 条，可配置
  - 单源失败写入 `_errors` 字段，不中断整体流程
- **输出**：`data/raw/WXX.json`

#### 2. 过滤 Agent

- **输入**：`data/raw/WXX.json` + `data/index.json`
- **行为**：
  1. 去重：对比 index.json 中已有 URL，命中则排除
  2. 三维评分（各 1-5）：
     - **实用度**：能直接改进工作流吗？有可操作的步骤吗？
     - **新鲜度**：是新信息吗？和已知内容重叠度多高？
     - **可信度**：来源权威性、论据完整性
  3. 阈值筛选：实用度 ≥ 3 且 新鲜度 ≥ 2
- **输出**：`data/filtered/WXX.json`（含评分理由）

#### 3. 摘要 Agent

- **输入**：`data/filtered/WXX.json`
- **行为**：按主题归类，详尽提炼核心内容，保留所有可点击 Markdown 链接
- **输出**：`reports/WXX/digest.md`

**摘要格式**：

```markdown
# 第 XX 周 AI Agent 使用技巧周报 (YYYY-MM-DD ~ YYYY-MM-DD)

## 官方动态
- [标题](链接) | 来源 | 日期
  详细摘要 + 对你工作流的影响分析

## 社区热帖 & 实战技巧
- [标题](链接) | 来源 | 日期
  核心观点 + 可提取的实践步骤

## 行业专家观点
- [标题](链接) | 来源 | 日期
  核心论点 + 对你的启发

## 工具与生态
- 工具名 | 来源 | 日期
  解决的问题，是否值得尝试

## 本周反思
- 上周采纳建议的实际效果反馈（如有）
```

#### 云端段完成后

GitHub Actions 将 `digest.md` 和更新的 `index.json` commit + push 回仓库。

---

### 本地段：Claude Code（你查看周报后手动触发）

你 `git pull` 后，Claude Code 读取本地配置文件生成建议。

#### 4. 建议 Agent（本地执行）

- **触发**：你在 Claude Code 中审阅完 digest.md 后
- **输入**：`reports/WXX/digest.md` + `C:\Users\ADMIN\.claude\CLAUDE.md` + `C:\Users\ADMIN\.claude\settings.json`
- **行为**：
  1. 解析 digest 中的技巧
  2. 读取当前 CLAUDE.md 和 settings.json
  3. 找出"有这个技巧后可以改进的现有配置"
  4. 生成 diff 级别的具体改法
- **输出**：`reports/WXX/actions.md`（每轮上限 5 条，按投入产出比排序）

**建议格式**：

```markdown
# 第 XX 周改进建议

## 建议 N：[标题]
- **现状**：你当前是怎么做的
- **问题**：存在什么可改进点
- **改进方案**：具体如何修改（diff 级别）
- **参考来源**：[链接]
- **改动范围**：CLAUDE.md / settings.json / 工作习惯
- **风险等级**：高 / 中 / 低
- **预计投入**：X 分钟
```

你审阅 actions.md 后，确认、拒绝或修改每条建议，Claude Code 执行你确认的改动。

## 五、去重机制

### index.json 结构

```json
{
  "entries": {
    "https://example.com/article-url": { "week": "2026-W20", "score": 4 },
    "https://reddit.com/r/ClaudeAI/...": { "week": "2026-W19", "score": 5 }
  }
}
```

### 去重规则

| 场景 | 处理方式 |
|------|----------|
| URL 完全匹配 | 直接排除 |
| 同 URL 不同来源（交叉帖） | 保留，取评分高者 |
| 同话题不同文章 | 保留，摘要时合并到同组 |
| 跨周重复有新进展 | 新鲜度 ≥ 4 才收录，标记为"续议" |

## 六、定时执行 — GitHub Actions

### 仓库信息

- **GitHub 用户**：1AoVoA1
- **仓库名**：HowToUsingAgent
- **可见性**：公开（GitHub Actions 分钟数无限免费）

### Secrets 配置

执行前需在 GitHub 仓库 Settings → Secrets and variables → Actions 中添加：

| Secret 名 | 值 | 说明 |
|-----------|-----|------|
| `DEEPSEEK_API_KEY` | `sk-***` | DeepSeek API 密钥，Actions 中调用 AI 模型 |
| `ANTHROPIC_API_KEY` | 可选 | 如需直连 Anthropic API 则配置 |

### Workflow 配置

```yaml
# .github/workflows/weekly-intel.yml
name: Weekly AI Agent Intel

on:
  schedule:
    - cron: '0 1 * * 1'  # 每周一 UTC 1:00 = 北京时间 9:00
  workflow_dispatch:       # 允许手动触发

jobs:
  pipeline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Pipeline
        env:
          DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
        run: bash scripts/pipeline.sh
      - name: Commit Reports
        run: |
          git config user.name "Weekly Intel Bot"
          git config user.email "bot@intel.local"
          git add reports/ data/index.json
          git diff --staged --quiet || git commit -m "Week $(date +%Y-W%V) intel report"
          git push
```

### 配额分析

| 资源 | 限制 | 本系统用量 | 占比 |
|------|------|-----------|------|
| GitHub Actions 分钟数 | 2,000/月 | ~80/月 | 4% |
| DeepSeek API | 按量付费 | ~每周 4-6 次调用 | — |
| 仓库空间 | 无限制 | <10 MB | 忽略 |

分钟数不会成为瓶颈。主要关注 DeepSeek API 的调用成本。

## 七、异常处理

| 情况 | 处理 |
|------|------|
| 某来源采集失败 | 记入 `_errors`，继续其他来源 |
| 过滤后零条 | 生成空周报，标记"本周无值得关注的新内容" |
| 某步完全失败 | 终止后续步骤，错误写入 `data/.last_error.md`，下次 cron 重试 |
| Actions 执行失败（网络/API故障） | 下次定时或手动 `workflow_dispatch` 重试 |
| 用户不在电脑旁 | 周报已 push 到仓库，`git pull` 后随时查看 |

## 八、用户参与点

### 执行流程

```
[云端：GitHub Actions]                    [本地：你的操作]
══════════════════════                    ════════════════
采集 → 过滤 → 摘要
       │
       ▼  digest.md push 到仓库
                                         → git pull 获取周报
                                         → 阅读 digest.md
                                         → 触发建议 Agent（本地）
                                              │
                                              ▼
                                         → 审阅 actions.md
                                           ├ 确认 → 执行配置改动
                                           ├ 拒绝 → 跳过，记录到 memory
                                           └ 修改 → 口头调整后执行
```

### 你只需做的事

1. 周一上班 `git pull` — 周报已经在仓库里
2. 读 digest.md — 了解本周技巧
3. 在 Claude Code 里说"生成建议" — 本地 Agent 针对你的配置生成 actions.md
4. 审阅 actions.md — 决定哪些执行
5. 执行确认的改动 — Claude Code 帮你改配置
