# 项目快速参考

## 流水线命令
```bash
# 本地运行（需要 DEEPSEEK_API_KEY）
node scripts/pipeline.js all

# 远程触发
gh workflow run weekly-intel.yml --repo 1AoVoA1/HowToUsingAgent

# 拉取最新周报
git pull origin master
```

## 目录约定
- `reports/YYYY-WXX/digest.md` — 每周中文周报
- `reports/YYYY-WXX/actions.md` — 改进建议（上限 5 条，按 ROI 排序）
- `config/sources.md` — 11 个信息源
- `scripts/pipeline.js` — 采集→过滤→摘要主脚本

## 每周工作流
1. 周二检查周报是否自动生成，未生成则手动触发
2. `git pull` 拉取周报
3. 在 Claude Code 中说"生成改进建议"
4. 审阅 `actions.md` → 执行确认的改动

## 采纳追踪
- W21-S1 (npm audit 集成): 待采纳
- W21-S2 (创建项目级 CLAUDE.md): ✅ 已采纳 (2026-05-19)
- W21-S3 (Dependabot 启用): 待采纳
- W21-S4 (memory 踩坑模板): ✅ 已采纳 (2026-05-19)
- W21-S5 (sources.md 新增 Simon Willison): 待采纳
