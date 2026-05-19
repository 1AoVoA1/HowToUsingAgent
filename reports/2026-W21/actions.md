# 第 21 周改进建议

> 基于 [digest.md](./digest.md)，对比当前 CLAUDE.md + settings.json 生成

---

## 建议 1：CI 流水线集成 npm audit 安全扫描

- **现状**：`.github/workflows/weekly-intel.yml` 只做 `npm ci` 安装依赖，不做安全审计。本地也无 pre-push hook 扫描依赖漏洞。
- **问题**：本周 W21 digest 最大预警 — SafeDep 报告 **314 个 npm 包被植入恶意代码**。当前项目依赖的 `openai`、`node-fetch`、`agentkeepalive` 等都是常见的供应链攻击目标。如果某个传递依赖被攻陷，CI runner 在 `npm ci` 阶段就会被感染。
- **改进方案**：在 workflow 中 `npm ci` 之后、`node scripts/pipeline.js all` 之前，加一步安全扫描：

```diff
       - name: Install dependencies
         run: npm ci

+      - name: Security audit
+        run: npm audit --audit-level=high
+
       - name: Run pipeline
         env:
           DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY }}
         run: node scripts/pipeline.js all
```

同时建议在本地 `package.json` 加一个脚本：

```json
"scripts": {
  "audit": "npm audit --audit-level=high"
}
```

- **参考来源**：[314 npm Packages Compromised](https://safedep.io/mini-shai-hulud-strikes-again-314-npm-packages-compromised/) — 来自 W21 社区热帖
- **改动范围**：`.github/workflows/weekly-intel.yml` + `package.json`
- **风险等级**：低（只扫描不阻断，`--audit-level=high` 仅在发现高危漏洞时使 CI 失败）
- **预计投入**：5 分钟

---

## 建议 2：创建项目级 CLAUDE.md，降低 Token 浪费

- **现状**：当前仅存在全局 `C:\Users\ADMIN\.claude\CLAUDE.md`，包含"关于我"、"沟通方式"等个人信息。项目 `F:\ClaudeWork\HowToUseAgent\` 下没有项目级 CLAUDE.md。
- **问题**：W21 digest 中 id-agent 项目明确指出了 **标识符和上下文的 Token 效率问题**。全局 CLAUDE.md 约 50 行，其中"关于我"、"沟通方式"、"自主边界"等章节是通用个人偏好，与本项目的采集-过滤-摘要流水线无直接关系。每次在此项目下与 Claude Code 交互时，这些通用内容都占用 Token。按 DeepSeek 计费模型，每天几十次交互——累积浪费可观。
- **改进方案**：在项目根目录创建 `CLAUDE.md`（不是 `.claude/CLAUDE.md`），只包含项目相关指令：

```markdown
# HowToUseAgent Project Context

## 项目
AI Agent 周度情报系统。每周采集 → 过滤 → 摘要 → 生成中文周报。

## 关键路径
- 流水线：`node scripts/pipeline.js [collect|filter|summarize|all]`
- 信息源：`config/sources.md`（11 个来源，3 层优先级）
- 周报：`reports/YYYY-WXX/digest.md`
- 远程触发：`gh workflow run weekly-intel.yml --repo 1AoVoA1/HowToUsingAgent`

## 项目规则
- 周报目录严格遵循 `reports/YYYY-WXX/` 命名
- 改进建议上限 5 条/周，按 ROI 排序
- 任务完成后同步更新 Readme.md 和 memory.md
- 配置变更优先改项目文件，不动全局 settings.json
```

全局 CLAUDE.md 保留个人偏好（沟通方式、红线等），项目级只放项目上下文。

- **参考来源**：[id-agent – Token efficient UUID](https://github.com/vostride/id-agent) — Token 效率思维
- **改动范围**：项目根目录新增 `CLAUDE.md`
- **风险等级**：低
- **预计投入**：10 分钟（创建文件 + 从全局 CLAUDE.md 分离项目内容）

---

## 建议 3：启用 GitHub Dependabot 自动依赖更新

- **现状**：项目无自动依赖更新机制。`package.json` 中 3 个运行依赖（`openai`、`node-fetch`、`agentkeepalive`）和若干间接依赖均靠手动更新。
- **问题**：W21 digest 的第一个洞察——供应链安全是 Agent 生态隐忧。npm audit 只能发现已知漏洞，不能防止新漏洞。Dependabot 可以在上游发布安全补丁后自动提 PR，缩短漏洞窗口期。此项目虽小（4 个直接依赖），但 CI runner 有 `repo` scope，一旦依赖被攻陷影响面不小。
- **改进方案**：创建 `.github/dependabot.yml`：

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 3
    versioning-strategy: increase
```

配置为每周一更新（在流水线运行前），PR 上限 3 个（避免噪音）。

- **参考来源**：[314 npm Packages Compromised](https://safedep.io/mini-shai-hulud-strikes-again-314-npm-packages-compromised/) + 本周洞察 #1
- **改动范围**：新增 `.github/dependabot.yml`
- **风险等级**：低（Dependabot 只提 PR，不自动合并）
- **预计投入**：3 分钟

---

## 建议 4：在 memory.md 建立结构化"踩坑记录"模板

- **现状**：`memory.md` 的"首次运行结果"记录了项目初始化时的 5 个问题，"采纳追踪"预留但未填写。整体是非结构化叙述。
- **问题**：W21 digest 的 Andon Labs AI 广播电台实验传达了一个关键教训——**Agent 自主运营的失败模式比成功案例更有学习价值**。当前项目的 memory.md 只记录了"发生了什么问题"，没有记录"为什么会误判"、"当时的假设是什么"、"修正后效果如何"。缺少这种因果链，同样的坑可能以不同面貌再踩一次。
- **改进方案**：在 `memory.md` 末尾新增结构化模板：

```markdown
## 踩坑记录

### 格式
- **日期**：YYYY-MM-DD
- **现象**：看到什么错误/异常行为
- **当时的假设**：我以为是什么原因
- **根因**：实际原因
- **修正**：做了什么
- **教训**：一句话——下次遇到类似信号，应该先检查什么
```

采用后，每次遇到 pipeline 异常、AI 响应质量问题、配置错误，按此格式追加一条。3 个月后回头看，这些记录会成为这个项目最有价值的隐性知识。

- **参考来源**：[We let AIs run radio stations](https://andonlabs.com/blog/andon-fm) — 失败模式比成功案例更有学习价值
- **改动范围**：`memory.md` 追加模板
- **风险等级**：低
- **预计投入**：5 分钟（添加模板），长期：每次踩坑 2 分钟记录

---

## 建议 5：信息源新增 "LLM 生态定期综述" 分类

- **现状**：`config/sources.md` 有 11 个来源，分 Core / Extended / Domestic 三层，全部聚焦于单个技巧、工具或官方更新。缺少宏观 LLM 生态校准来源。
- **问题**：W21 digest 最有价值的条目之一 —— **Simon Willison 的 "The last six months in LLMs in five minutes"** —— 来自 Hacker News 的偶然捕获，而非信息源目录主动监控。这类定期综述的价值在于纠正认知漂移："你以为现在的 LLM 生态还是半年前的样子，但其实已经变了"。当前项目关注"周级"技巧，但缺少"月级"或"季度级"的生态校准视角。
- **改进方案**：在 `config/sources.md` 的 Extended 层新增一条：

```markdown
- name: Simon Willison's Blog
  url: https://simonwillison.net/
  lang: en
  type: expert
  method: webfetch
  priority: extended
  last_verified: 2026-05-19
```

另外建议在 `data/` 下新建 `calibration.md`，每季度手动或自动生成一次 LLM 生态现状综述（模型能力变化、工具链趋势、最佳实践演进），作为"认知锚点"参考文档。

- **参考来源**：[The last six months in LLMs in five minutes](https://simonwillison.net/2026/May/19/5-minute-llms/) — W21 社区热帖
- **改动范围**：`config/sources.md`（新增 1 条来源），`data/calibration.md`（新建）
- **风险等级**：低
- **预计投入**：5 分钟（改 sources.md），季度投入：30 分钟（生成 calibration.md）
