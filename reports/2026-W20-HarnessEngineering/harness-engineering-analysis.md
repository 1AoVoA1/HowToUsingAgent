# OpenAI "Harness Engineering" 文章分析与总结

> **原文**: [Harness engineering: Leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/)
> **作者**: Ryan Lopopolo（OpenAI 工程师）
> **发布时间**: 2026 年 2 月
> **Martin Fowler 评论**: [Harness Engineering - first thoughts](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering-memo.html)

---

## 一、文章背景与实验规模

2026 年 2 月，OpenAI 工程师 Ryan Lopopolo 发布了一篇引发行业震动的文章，记录了一场内部实验：一支 3 人（后扩展至 7 人）的工程师团队，在 5 个月内从零构建了一个包含约 100 万行代码的生产级产品——**没有人工编写任何一行代码**。

| 指标 | 数据 |
|---|---|
| 团队规模 | 3 人 → 7 人 |
| 时间跨度 | 5 个月 |
| 代码总量 | ~100 万行 |
| PR 数量 | ~1,500 个 |
| 人均日 PR | 3.5 个（团队扩张后仍增长） |
| 手写代码 | **0 行** |
| 效率 | 约为手写代码的 1/10 时间 |
| 单次 Agent 运行 | 6+ 小时 |

---

## 二、分段总结

### 第一部分：核心理念——人类掌舵，Agent 执行

文章开篇提出 Harness Engineering 的核心公式：

```
Agent = Model + Harness
```

- **Model**：大模型本身（GPT/Claude/Gemini），负责推理与理解
- **Harness**：模型之外的一切——系统提示词、工具定义、上下文管理、错误处理、重试逻辑、安全边界、反馈回路

核心论点：**工程师的产出不再是代码，而是一个约束系统**。工程师的工作从"编写代码"转变为"设计环境、明确意图、构建反馈回路"。

> *"The discipline demanded by software engineering is no longer in the code itself, but in the supporting structures, tools, abstractions, and feedback loops."*

### 第二部分：六大关键实践

#### 实践 1：仓库即记录系统（Repo-as-Truth）

不在仓库里的知识——Slack 讨论、Google Docs、工程师脑中的想法——对 Agent **等于不存在**。

一切决策、规范、计划必须作为版本化工件提交到仓库。这不是为了方便人类查阅，而是为了让 Agent 能够"看见"。

> *"Codex 看不见的东西就不存在。"*

#### 实践 2：地图而非百科全书（Map, Not Manual）

`AGENTS.md` 控制在 ~100 行，只做**目录/索引**，不堆放所有规则。

- 真正知识分散在 `docs/` 结构化目录中
- **渐进式披露**（Progressive Disclosure）：Agent 按需读取，不被海量信息淹没
- CI/Linter 机械验证文档时效性
- 定期运行 "doc-gardening" Agent 清理过时文档

核心洞察：Agent 的上下文窗口是稀缺资源。巨型指令文件会挤占上下文、无法维护、无法机械验证。

> *"Give Codex a map, not a 1,000-page instruction manual."*

#### 实践 3：机械化约束执行（Mechanical Enforcement）

文档会腐烂，lint 规则不会。

- **严格六层架构**：Types → Config → Repo → Service → Runtime → UI，依赖单向、不可逆
- 横切关注点（auth、telemetry、logging）只能通过 Provider 接口注入
- 自定义 Linter + 结构测试强制执行架构边界
- **关键细节**：Lint 错误消息内嵌修复指令 → Agent 可自我纠正 → 形成自动反馈回路

#### 实践 4：Agent 可读性优先（Agent Legibility）

在做技术选型时，Agent 能不能"理解"代码成为首要考量：

- 偏好 API 稳定、可组合、训练语料覆盖广的"无聊"技术
- 宁可自己重写小功能，也不引入行为不透明的外部依赖
- 应用按 **git worktree** 隔离启动，每个任务环境临时、用完即销毁
- 接入 **Chrome DevTools Protocol**，Agent 能截图、读 DOM、导航、复现 bug
- 日志/指标/trace 通过可观测性栈（LogQL + PromQL）暴露给 Agent

#### 实践 5：吞吐量改变合并哲学

当 Agent 每天提交 3.5 个 PR，传统代码审查流程必须重构：

- **极少的阻塞式合并门**（merge gates）
- PR 生命周期极短
- 测试偶发失败（flake）通过后续重跑解决，不长期卡住 PR
- 核心权衡：**纠错便宜，等待昂贵**

在 Agent 吞吐量远超人类注意力的系统中，宁可让一个偶有瑕疵的 PR 通过后快速修复，也不让几十个 PR 排队等待人工审查。

#### 实践 6：熵管理与垃圾回收（Entropy Management & GC）

Agent 会自动复现仓库中已有的模式——包括坏模式。

- 早期做法：每周五 20% 时间手动清理 "AI slop"，不可扩展
- 改进做法：将"黄金规则"编码进仓库 → 后台 Agent 定期扫描偏差 → 自动发起小型重构 PR → 多数一分钟内可审完 auto-merge
- 类比：**技术债是高息贷款，持续小额偿还远好于复利积累后一次性处理**

### 第三部分：工程师角色转变

文章用一张对照表描绘了工程师身份的彻底转变：

| 旧角色 | 新角色 |
|---|---|
| 写代码 | 设计环境 |
| 逐行审查 | 只在关键节点介入 |
| 手动 QA | 定义验收标准，Agent 自验 |
| 修 bug | 补能力 / 补文档 / 补约束 |

当 Agent 遇到困难时，不再是人去修代码，而是人去诊断：**缺了什么？是工具不够？护栏不清晰？还是文档有歧义？** 补齐缺失项后，Agent 自然就能完成。

> *"When the agent struggles, we treat it as a signal: identify what is missing — tools, guardrails, documentation — and feed it back into the repository."*

### 第四部分：端到端 Agent 自主流程

文章中描述了一个完整的 Agent 自主工作循环：

```
验证仓库状态 → 复现 Bug 并录制视频 
→ 实施修复 → 启动应用自验 
→ 录制演示 → 开 PR 并回应评审 
→ 自检修复 CI 故障 → 仅在必要时交人工 → 合并
```

关键点：这个流程中人类只在"必要时"介入，其余全部由 Agent 自主完成——包括回应 PR 评审和修复 CI 故障。

---

## 三、核心技术架构

### Agent Loop（最简循环）

Codex CLI 的核心 Agent Loop 反直觉地简洁：

```
用户输入 → 模型推理 → 输出两条路：
  ├─ 最终回复 → 结束
  └─ 工具调用 → 执行 → 输出追加到上下文 → 重新推理 → 循环
```

**关键设计决策**：
- **框架越"笨"，模型越"聪明"**：编排逻辑交给模型自己，Harness 只提供最小化约束
- **无状态请求处理**：每次 API 调用自包含
- **提示词缓存优化**：精确前缀匹配实现缓存命中
- **自动上下文窗口管理**：超出阈值时自动压缩对话
- 单次运行可做数百轮工具调用，经常连续工作 6+ 小时

### Martin Fowler 的 Harness 分类

ThoughtWorks 的 Birgitta Böckeler 在 Martin Fowler 博客上将该文的 Harness 组件分为三类：

1. **上下文工程（Context Engineering）**：代码仓库中的持续增强知识库 + 可观测性数据 + 浏览器导航
2. **架构约束（Architectural Constraints）**：不仅靠 LLM 监控，更靠确定性自定义 Linter 和结构测试
3. **垃圾回收（Garbage Collection）**：定期运行的 Agent 扫描不一致、过时文档、架构违规

---

## 四、核心观点提炼

### 1. "Harness"是新的核心竞争力

在 agent-first 时代，模型能力趋于商品化，真正的差异化来自 Harness——即模型之外的所有工程化设施。谁能构建更好的上下文管理、更精准的约束系统、更高效的反馈回路，谁就能从同一个模型中提取更多价值。

### 2. 约束即生产力

传统软件工程追求"灵活性"和"可扩展性"，Harness Engineering 反其道而行——**刻意约束 Agent 的行为空间**。严格的六层架构、单向依赖、Provider 注入，这些限制不是束缚，而是让 Agent 在安全边界内高效运作的前提。

### 3. 文档从"给人看"变为"给 Agent 用"

AGENTS.md 和 docs/ 目录不再是传统意义上的文档，而是 Agent 的"运行时知识库"。这要求文档具备：结构化、可版本化、可机械验证、渐进式加载——这些属性传统文档几乎都不具备。

### 4. 纠错成本 < 等待成本

这是全文最具颠覆性的工程判断。传统 CI/CD 用阻塞门保证质量（lint → test → review → merge），但 Agent 的吞吐量让阻塞成本急剧放大。OpenAI 的实践表明：降低合并门槛 + 快速修复的总体效率远超严格门禁。

### 5. 熵管理是持续性工程问题

Agent 会学习和复现模式——包括坏模式。如果不主动管理，仓库质量会持续恶化。OpenAI 的解决方案是将"黄金规则"编码化 → 自动化扫描 → 自动化小 PR 修复，形成"持续小偿"的垃圾回收闭环。

### 6. 工程师不会被取代，但角色彻底改变

人类工程师的价值从"执行"转移到"设计"——设计约束、设计反馈回路、设计环境。这要求工程师具备更高层次的系统设计能力，而非更多的编码技巧。

---

## 五、实践建议

### 对当前项目的建议

1. **将 CLAUDE.md 精简为地图模式**
   - 当前 CLAUDE.md 已经比较精简，但可以更进一步：将其变为纯索引，真正细节分散到 `docs/` 目录
   - 例如：将"质量兜底规则"的详细触发条件移入 `docs/quality-escalation.md`，CLAUDE.md 只保留一行链接

2. **引入机械化的文档验证**
   - 当前 config/ 目录的 sources.md 和 pipeline.md 可能随信息源变化而过时
   - 增加 CI 步骤：定期检查 sources.md 中列出的 URL 是否可达、pipeline.md 参数是否仍在使用
   - 当检查失败时，自动触发 doc-gardening Agent（如果有的话）

3. **为 pipeline.js 增加 Agent 可读性**
   - 当前 `pipeline.js` 中有 `extractJSON` helper——这种"防御性解析"正是 Harness Engineering 强调的模式
   - 可以进一步：当评分/摘要质量低时，将失败信号反馈给调用的 Agent，形成自愈回路

4. **执行"垃圾回收"节奏**
   - 建议每 4 周运行一次项目健康检查：config 是否准确？memory.md 是否有过时条目？sources 是否仍然有效？

### 通用的团队建议

5. **重新定义 PR review 标准**
   - 对于 Agent 生成的 PR，review 重点从"代码正确性"转向"是否符合架构边界"和"是否引入了意外副作用"
   - 对于低风险、小范围的 Agent PR，设置 auto-merge 阈值

6. **投资 Harness 而非模型**
   - 与其追逐最新模型，不如投资：更好的 AGENTS.md、更精准的 lint 规则、更完整的可观测性暴露
   - 一个中等模型 + 优秀 Harness 的产出，可能超过最强模型 + 糟糕 Harness

---

## 六、总结

OpenAI 的 Harness Engineering 不是一套工具或框架，而是一种**范式转移的宣言**：在 agent-first 时代，软件工程的纪律不再体现在代码本身，而体现在支撑 Agent 运行的环境、约束和反馈回路中。

它的核心公式——`Agent = Model + Harness`——将 AI 编程的焦点从"模型能力竞赛"拉回到"工程化落地能力"。模型越来越强，但决定一个团队能从模型中榨取多少价值的，是 Harness 的质量。

对于任何正在或将要大规模使用 AI Agent 进行软件开发的团队，这篇文章是必读之作——它不是告诉你"AI 多厉害"，而是告诉你"怎么让 AI 真的能干活"。

---

*文档生成时间: 2026-05-17*
*数据来源: OpenAI 官方博客 (openai.com/index/harness-engineering)、Martin Fowler 博客评论、多个第三方技术分析*
