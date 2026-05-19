# 第 20 周改进建议

> 基于 [digest.md](./digest.md)，对比当前 CLAUDE.md + settings.json 生成

---

## 建议 1：为 CLAUDE.md 每条规则补充"为什么"

- **现状**：CLAUDE.md 的思维原则、工程纪律等每条只有"是什么"，没有"为什么"。例如"先确定需求"只有一句话，未说明背后的考量。
- **问题**：Anthropic 的"Teaching Claude why"研究表明，仅告诉 Agent "做什么"而不解释"为什么"，在复杂任务链中 Agent 更容易偏离预期行为。当前 CLAUDE.md 是纯规则清单，Claude 知道规则但不知道规则背后的意图，遇到边界情况时可能死板执行或错误绕过。
- **改进方案**：在每条规则后追加一行 `为什么：...` 的简短解释（不超过 20 字），例如：

```diff
  ## 思维原则
- - **本质思考**：所有决策从问题本质出发，不因"惯例如此"而照搬。回到问题本身：要解决什么？最直接的路径是什么？
+ - **本质思考**：所有决策从问题本质出发，不因"惯例如此"而照搬。回到问题本身：要解决什么？最直接的路径是什么？——_为什么：惯例会过时，问题本质不变；从本质出发的方案更少返工。_
- - **直言不讳**：不要谄媚。不要夸我的想法好，也不要说"这是个很好的问题"。直接给出真实判断，如果方案有问题就指出来。
+ - **直言不讳**：不要谄媚。不要夸我的想法好，也不要说"这是个很好的问题"。直接给出真实判断，如果方案有问题就指出来。——_为什么：节省沟通成本，错误方案被及时纠正的收益远大于被否定时的短暂不适。_
```

其他关键条目同样处理（沟通方式、质量兜底规则最重要，红线/纪律次之）。

- **参考来源**：[Teaching Claude why](https://www.anthropic.com/research/teaching-claude-why)
- **改动范围**：CLAUDE.md
- **风险等级**：低
- **预计投入**：10 分钟

---

## 建议 2：在 CLAUDE.md 新增"预期行为"章节

- **现状**：CLAUDE.md 定义了规则和边界，但没有描述"理想的工作状态是什么样的"。
- **问题**：Anthropic 对 81,000 名用户的调研表明，用户最核心的诉求是 Agent 的**可预测性**和**可控性**。当前 CLAUDE.md 侧重"不能做什么"（红线），缺少"应该是什么样"的正向示范。一个"预期行为"章节可以让 Claude 自我校准。
- **改进方案**：在 CLAUDE.md 末尾新增：

```markdown
## 预期协作行为

你在与我协作时应该表现出以下特征：

- **完成任务后主动验证，不问我"要不要测试一下"** — 直接跑测试/验证命令，把结果给我
- **发现我的方案有问题时，先指出问题再给替代方案** — 只说"不好"等于没说
- **3 步以内的简单操作不征求意见直接做** — 文件修改、删除、外部资源下载仍需确认
- **代码解释控制在 3 句以内** — 除非我追问"为什么"
- **每次回复后不需要总结做了啥** — 我能看到 diff，重复信息是噪音

如果连续 3 次交互偏离以上行为，我会提醒"回归预期"。
```

- **参考来源**：[What 81,000 people want from AI](https://www.anthropic.com/research/what-81000-people-want-from-ai)
- **改动范围**：CLAUDE.md
- **风险等级**：低
- **预计投入**：5 分钟

---

## 建议 3：移除不必要的 hooks 减少延迟

- **现状**：settings.json 中 10 个 hook 事件全部触发同一个 PowerShell 脚本（`ooclaw-hook.ps1`），包括高频事件 PreToolUse、PostToolUse、PermissionRequest。
- **问题**：每次工具调用（每次读文件、搜索、编辑）都触发两次 PowerShell 进程（Pre + Post），在 Windows 上 PowerShell 启动成本 ~0.5-1s。假设一次对话有 30 次工具调用，累积延迟 30-60 秒。而 hook 内容未知（可能是日志/监控），如果只是记录审计日志，性价比极低。
- **改进方案**：保留低频关键事件（SessionStart、SessionEnd、Stop、PreCompact），移除高频事件 hook：

```diff
  "hooks": {
-   "PermissionRequest": [
-     { "matcher": "*", "hooks": [{ "type": "command", "command": "powershell.exe ..." }] }
-   ],
-   "PostToolUse": [
-     { "matcher": "*", "hooks": [{ "type": "command", "command": "powershell.exe ..." }] }
-   ],
-   "PreToolUse": [
-     { "matcher": "*", "hooks": [{ "type": "command", "command": "powershell.exe ..." }] }
-   ],
-   "SubagentStop": [
-     { "hooks": [{ "type": "command", "command": "powershell.exe ..." }] }
-   ],
-   "UserPromptSubmit": [
-     { "hooks": [{ "type": "command", "command": "powershell.exe ..." }] }
-   ],
    "PreCompact": [...],     // 保留
    "SessionStart": [...],   // 保留
    "SessionEnd": [...],     // 保留
    "Stop": [...],           // 保留
  }
```

如果你确认 hook 只是日志/监控用途，可以考虑全部移除。如果 hook 有安全审计等硬需求，至少移除 PreToolUse/PostToolUse（最高频）。

- **参考来源**：[Why senior developers fail to communicate their expertise](https://www.nair.sh/guides-and-opinions/communicating-your-expertise/why-senior-developers-fail-to-communicate-their-expertise) — 隐性知识显式化的启示：如果 hook 的必要性不能一句话说清，那它可能就不必要
- **改动范围**：settings.json
- **风险等级**：中（取决于 hook 是否有安全/合规硬需求）
- **预计投入**：5 分钟（先查看 `ooclaw-hook.ps1` 确认用途）

---

## 建议 4：对非核心 Agent 调用使用 flash 模型节约成本

- **现状**：所有模型都指向 DeepSeek V4 Pro（`deepseek-v4-pro[1m]`），包括 haiku 和 sonnet 占位。effort 固定为 "max"。
- **问题**：本周情报系统架构的经验（Needle 模型的启示：大模型对简单任务过杀）同样适用于 Claude Code 日常使用。你在当前会话中分派了大量 haiku 级别的子 Agent（项目初始化、文档写入等机械任务），但它们实际跑的是昂贵的 Pro 模型。DeepSeek 按 token 计费，flash 和 pro 成本差可能 3-5 倍。
- **改进方案**：将 haiku 占位指向 flash 模型，sonnet 保持 pro：

```diff
  "env": {
-   "ANTHROPIC_DEFAULT_HAIKU_MODEL": "deepseek-v4-flash",
+   "ANTHROPIC_DEFAULT_HAIKU_MODEL": "deepseek-v4-flash",
-   "ANTHROPIC_DEFAULT_SONNET_MODEL": "deepseek-v4-pro[1m]",
+   "ANTHROPIC_DEFAULT_SONNET_MODEL": "deepseek-v4-pro[1m]",
-   "ANTHROPIC_MODEL": "deepseek-v4-pro[1m]",
+   "ANTHROPIC_MODEL": "deepseek-v4-pro[1m]",
  }
```

实际上当前配置已经正确：haiku→flash，sonnet/opus→pro。但还有优化空间：将 `CLAUDE_CODE_EFFORT_LEVEL` 从 "max" 改为根据任务类型动态设置。max 对简单任务多消耗 token 而收益不明显。

如果 DeepSeek 支持 effort 参数，建议新增 hook 或习惯：**简单任务（单文件修改、搜索、文档写入）用 haiku/flash + effort "low"，复杂推理（架构设计、多文件重构）才用 sonnet/pro + effort "max"**。

- **参考来源**：Needle 案例 — [cactus-compute/needle](https://github.com/cactus-compute/needle) — "工具调用本质是检索+组装，大模型对此过杀"
- **改动范围**：settings.json + 工作习惯
- **风险等级**：低
- **预计投入**：2 分钟（确认配置），长期：养成任务分级习惯

---

## 建议 5：为复杂任务前置写"推理上下文"段落

- **现状**：向 Claude Code 提出复杂任务时，通常直接描述需求和约束，没有显式的"推理指引"。
- **问题**：本周 "Teaching Claude why" 和 "资深开发者沟通困境" 两个来源形成共识——让 Agent/人理解"为什么做"和"怎么判断对错"，比只说"做什么"更能保证结果质量。当前 CLAUDE.md 中的"先计划再执行"走了一半，但计划阶段没有要求 Claude 复述它对任务的理解和预期产出标准。
- **改进方案**：在 CLAUDE.md 的"思维原则"中新增一条：

```markdown
- **复杂任务先复述再计划**：对于涉及多文件修改、架构决策、或外部依赖的任务，
  在制定计划前先用 2-3 句话复述：要解决什么、为什么是现在、成功的验收标准是什么。
  我确认理解正确后，再进入"先计划再执行"流程。
```

同时作为工作习惯：当你提出复杂任务时，先自己用一句话写清"验收标准"（例如："修完后 `npm test` 全部通过且无新增 warning"），Claude 就不会在模糊边界上猜你的意图。

- **参考来源**：[Teaching Claude why](https://www.anthropic.com/research/teaching-claude-why) + [Why senior developers fail to communicate their expertise](https://www.nair.sh/guides-and-opinions/communicating-your-expertise/why-senior-developers-fail-to-communicate-their-expertise)
- **改动范围**：CLAUDE.md + 工作习惯
- **风险等级**：低
- **预计投入**：3 分钟（改 CLAUDE.md），长期：每次复杂任务多花 30 秒前置思考
