# AI Agent 周度情报系统

每周自动采集全球 AI Agent 使用技巧与最佳实践 → 过滤评分 → 生成详细周报 → 产出 Claude Code 改进建议。

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

## 快速开始

```bash
git clone https://github.com/1AoVoA1/HowToUsingAgent.git
cd HowToUsingAgent
npm install
```

## 本地运行

```bash
# 需要设置 DEEPSEEK_API_KEY 环境变量
export DEEPSEEK_API_KEY=your_key_here
node scripts/pipeline.js all
```

## 周报结构

```
reports/YYYY-WXX/
└── digest.md    # 本周详细摘要（官方动态 / 社区技巧 / 专家观点 / 工具生态 / 本周洞察）
```

## 项目结构

```
├── .github/workflows/    # CI 定时触发
├── config/               # 信息源目录、流水线配置
├── scripts/              # pipeline.js：采集→过滤→摘要
├── data/                 # 原始/过滤数据 + 去重索引
├── reports/              # 每周周报（digest.md）
├── memory.md             # 项目运行经验
└── Readme.md
```

## 本地生成改进建议

每周 git pull 获取最新周报后，在 Claude Code 中说：

> 读取本周的 reports/YYYY-WXX/digest.md，对比我当前的 CLAUDE.md 和 settings.json，找出可以改进的地方，生成 actions.md。每轮上限 5 条，按投入产出比排序。

## 配置

- **信息源**：`config/sources.md` — 11 个来源，按优先级分层
- **流水线参数**：`config/pipeline.md` — 评分阈值、采集上限
- **GitHub Secrets**：`DEEPSEEK_API_KEY` — DeepSeek API 密钥

## 维护

- 信息源由 Agent 定期验证更新
- 项目运行经验记录在 `memory.md`
- 手动触发流水线：`gh workflow run weekly-intel.yml --repo 1AoVoA1/HowToUsingAgent`
