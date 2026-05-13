# 项目记忆

## 初始设置
- 日期：2026-05-13
- 信息来源：11 个来源（Anthropic Blog/Docs, Reddit x3, X x2, HN, GitHub, 知乎, B站）
- 执行环境：GitHub Actions (ubuntu-latest, Node.js 20)
- AI 模型：DeepSeek Chat API
- 定时：每周一 UTC 1:00 (北京时间 9:00)
- GitHub repo：https://github.com/1AoVoA1/HowToUsingAgent

## 首次运行结果（2026-W20）
- 采集：36 条 → 过滤后 13 条通过评分 → 生成完整 digest.md
- 问题1：GitHub Actions 推送权限需手动设为 Read and write
- 问题2：DeepSeek JSON 响应有时包在 ```json 中，已通过 extractJSON helper 修复
- 注意：X/Nitter 来源在 CI 环境不稳定，专家观点栏常为空
- 注意：评分对 AI Agent 主题相关度筛选不够精准，需优化评分 prompt
- HN 内容占比过高，后续可调整 scoring 增加"领域相关度"维度

## 建议 Agent 提示词（在 Claude Code 中本地执行）

每周 git pull 后，在 Claude Code 中说：

"读取本周的 reports/YYYY-WXX/digest.md，对比我当前的 CLAUDE.md 和 settings.json，
找出可以改进的地方，生成 actions.md。每轮上限 5 条，按投入产出比排序。
每条建议包含：现状、问题、改进方案（diff 级别）、风险等级、预计投入。"

## 采纳追踪
- (每周记录已执行建议及效果)
