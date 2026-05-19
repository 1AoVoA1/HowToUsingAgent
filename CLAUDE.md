# HowToUseAgent 项目上下文

## 项目
AI Agent 周度情报系统。每周采集全球 AI Agent 使用技巧 → 过滤评分 → 生成中文周报 → 产出 Claude Code 改进建议。

## 关键命令
- 流水线：`node scripts/pipeline.js [collect|filter|summarize|all]`（需要 `DEEPSEEK_API_KEY`）
- 远程触发：`gh workflow run weekly-intel.yml --repo 1AoVoA1/HowToUsingAgent`
- 拉取周报：`git pull origin master`
- 依赖安装：`npm install`

## 目录结构
- `config/sources.md` — 11 个信息源（Core / Extended / Domestic 三层）
- `config/pipeline.md` — 流水线评分阈值、采集上限
- `scripts/pipeline.js` — 采集→过滤→摘要主脚本（DeepSeek API）
- `data/` — 原始/过滤数据 + `index.json` 去重索引
- `reports/YYYY-WXX/digest.md` — 每周中文周报
- `reports/YYYY-WXX/actions.md` — 本周改进建议（上限 5 条）
- `memory.md` — 项目运行经验、踩坑记录

## 项目约定
- 周报目录严格遵循 `reports/YYYY-WXX/` 命名
- 改进建议上限 5 条/周，按投入产出比排序
- 改进建议格式：现状 → 问题 → 改进方案（diff 级别）→ 参考来源 → 风险等级 → 预计投入
- 任务完成后同步更新 Readme.md 和 memory.md
- 配置变更优先改项目文件，不动全局 settings.json

## 已知问题
- X/Nitter 来源在 CI 环境不稳定，专家观点栏常为空
- HN 内容占比过高，评分对 AI Agent 主题相关度筛选不够精准
- DeepSeek JSON 响应可能包在 markdown 代码块中（pipeline 已有 extractJSON 兜底）
- 周一自动 cron 可能不触发，需定期检查
