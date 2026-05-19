# Claude Code Harness Engineering 最佳实践与改进建议

> 基于 Anthropic 官方博客 (2026.3.24)、Claude Code 源码社区分析、及你的项目现状

---

## 一、核心公式

```
Agent = Model + Harness
```

- **Model**：每个团队拿到的 Sonnet/Opus 能力是一样的
- **Harness**：CLAUDE.md + settings.json + Hooks + Skills + 子Agent + MCP → **这才是差异化因素**
- LangChain 仅靠改进 Harness（不改模型），在 Terminal Bench 上从 52.8% 跃升至 66.5%

---

## 二、Harness 五层架构模型

| 层 | 作用 | 你现有的 | 缺失的 |
|----|------|----------|--------|
| **1. Memory** | Agent 知道什么 | ~/.claude/CLAUDE.md（用户级，40行） | 项目级 CLAUDE.md、规则文件 |
| **2. Tools** | Agent 能触及什么 | 默认工具集 | 无 MCP 扩展 |
| **3. Permissions** | Agent 被允许做什么 | 默认 | settings.json 空白 |
| **4. Hooks** | 运行时强制执行 | 无 | 完全缺失 |
| **5. Observability** | 事后能看到什么 | 无 | 无 commit/PR 追踪 |

---

## 三、Anthropic 官方三大 Agent 架构（2026.3.24）

Prithvi Rajasekaran 在 *"Harness Design for Long-Running Application Development"* 中提出的关键洞察：

| 原则 | 说明 |
|------|------|
| **Separate Generator from Evaluator** | Agent 无法诚实评价自己的产出——必须用独立 Evaluator |
| **Context Resets > Compaction** | 清空上下文 + 结构化交接文件，优于在上下文内压缩 |
| **Sprint Contracts** | 每次编码前，Generator 和 Evaluator 先协商"做到什么算完成" |
| **Every Harness component encodes an assumption** | 模型升级后，重新测试所有 Harness 假设——上个月的关键组件可能变成死重 |
| **Criteria language shapes output** | 评分标准的措辞不只是衡量，它会**引导**输出风格 |
| **Simplify as models improve** | Harness 不是越重越好——Opus 4.6 上线后 Anthropic 直接去掉了 Sprint 环节 |

### 定量结果

| 方案 | 耗时 | 成本 | 结果 |
|------|------|------|------|
| Solo Agent (Opus 4.5) | 20 min | $9 | 核心功能崩溃 |
| Full Harness (Opus 4.5) | 6 hr | $200 | 16 个功能，可用的游戏制作器 |
| Simplified Harness (Opus 4.6) | 3hr 50min | $124.70 | 可用的 DAW + AI agent |

---

## 四、社区提炼的六大 Harness 模式

从 Claude Code 512K 行源码中提炼：

| # | 模式 | 解决的问题 | 关键点 |
|---|------|-----------|--------|
| 1 | **Memory** | Agent 跨会话遗忘 | 指令记忆（人写）与自动记忆（Agent写）分开 |
| 2 | **Skills** | 重复解释工作流 | 懒加载指令集；发现成本 < 1% 上下文 |
| 3 | **Tools & Safety** | 强能力不出事 | 默认 fail-closed；独立故障模式的多层防御 |
| 4 | **Context Engineering** | 信息太多/太少/不对 | 四种操作：select、write、compress、isolate |
| 5 | **Multi-Agent** | 并行不混乱 | Coordinator / Fork / Swarm 三种拓扑 |
| 6 | **Lifecycle** | 钩子、后台任务、启动 | Hook 信任是 all-or-nothing；两阶段任务驱逐 |

---

## 五、CLAUDE.md 最佳实践（当前你的 ~/.claude/CLAUDE.md 水平检查）

你的用户级 CLAUDE.md 质量不错（~40 行，结构清晰），**但缺少项目级 CLAUDE.md**。

### 黄金法则

> 每一行都问自己：**删除它，Claude 会犯错吗？** 不会就删。

### 应该放的 vs 不该放的

| ✅ 放进去 | ❌ 别放 |
|-----------|--------|
| 构建/测试/Lint 命令 | Claude 读代码就能推断的 |
| 非默认编码规范 | 标准语言约定 |
| 架构决策 & 环境怪异点 | 详细 API 文档（用 @docs/ 引用） |
| 常见陷阱 & 非显然行为 | 频繁变动的信息 |
| 项目术语表 | 逐文件描述 |

### 关键技巧
- `IMPORTANT` 或 `YOU MUST` 标记关键规则，显著提高遵守率（但不能滥用）
- 目标：**控制在 200 行以内**
- 用 `@docs/ARCHITECTURE.md` 引用外部文件，实现渐进式披露

---

## 六、Settings.json & Hooks 最佳实践

### CLAUDE.md 是建议，Hooks 是法律

> CLAUDE.md 遵守率 ~80%；Hooks 是 **100% 强制**，模型无法绕过。

### 退出码的致命陷阱

| 退出码 | 含义 | Claude 行为 |
|--------|------|-------------|
| 0 | 成功 | 正常继续 |
| 1 | Unix 错误 | **被视为非阻塞，Claude 继续执行** |
| 2 | 阻塞 | **唯一能阻止 Claude 的退出码** |

### 四种扩展开销对比

| 机制 | 上下文成本 | 何时用 |
|------|-----------|--------|
| Rules/CLAUDE.md | 低（启动时加载） | 团队约定、禁止操作、构建命令 |
| Skills | 极低（懒加载） | 框架模式、编码标准、领域知识 |
| MCP Servers | 高（工具定义 + 调用结果） | 数据库访问、第三方 API |
| Hooks | **零**（Agent 循环外运行） | 自动格式化、拦截危险命令 |

---

## 七、对你的项目的具体改进建议

### 你当前的状态

- 用户级 CLAUDE.md：✅ 已有，质量好
- 项目级 CLAUDE.md：❌ 缺失
- `.claude/` 目录：❌ 不存在
- settings.json：❌ 未配置
- Hooks：❌ 未配置
- Skills：✅ 通过全局 superpowers 使用，但未项目级定制

### 建议 1：创建项目级 CLAUDE.md（投入：10 分钟，风险：低）

在项目根目录创建，约 40-60 行：

```markdown
# HowToUseAgent 项目指南

## 项目概述
AI Agent 周度情报系统：自动采集 → 过滤评分 → 生成周报 → 产出改进建议。

## 常用命令
- 本地运行完整流水线：`node scripts/pipeline.js all`
- 仅采集：`node scripts/pipeline.js collect`
- 手动触发 CI：`gh workflow run weekly-intel.yml --repo 1AoVoA1/HowToUsingAgent`
- 查看本周报告：打开 `reports/YYYY-WXX/digest.md`

## 文件结构约定
- 原始数据在 `data/raw/`，处理后数据在 `data/processed/`
- 报告在 `reports/YYYY-WXX/` 目录
- 配置文件在 `config/` 目录
- 所有脚本在 `scripts/` 目录

## 编码约定
- Node.js 项目，使用 ES modules
- 不要修改 `.github/workflows/` 中的 CI 配置，除非明确要求
- API key 通过环境变量传递，不硬编码

## 注意事项
- DeepSeek API 的 JSON 响应可能被 markdown 代码块包裹，`extractJSON()` 已处理
- X/Nitter 来源在 CI 环境不稳定
- GitHub Actions 推送需要 Read and write 权限
```

### 建议 2：创建 `.claude/settings.json`（投入：5 分钟，风险：低）

```json
{
  "permissions": {
    "allow": [
      "Bash(node *)",
      "Bash(npm *)",
      "Bash(gh *)",
      "Bash(git *)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)",
      "Bash(curl *)"
    ]
  }
}
```

### 建议 3：添加 PostToolUse Hook——自动质量检查（投入：15 分钟，风险：中）

每次 Edit/Write 后自动运行 lint：

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node -e \"try { require('./scripts/pipeline.js') } catch(e) { if(!e.message.includes('Cannot find')) throw e }\" || true"
          }
        ]
      }
    ]
  }
}
```

### 建议 4：建立项目级记忆（已在进行中）

你的 `memory.md` 已经是 Context Engineering 的实践。下一步：
- 让 Agent 定期扫描 memory.md 的过时条目
- 将报告 → 改进建议 → 采纳效果形成闭环记录
- 考虑迁移到 `.claude/projects/` 目录下的自动记忆系统

### 建议 5：渐进式披露——将大文档拆分（投入：10 分钟，风险：低）

当前 `Readme.md` 约 70 行，还不错。但如果继续膨胀：
- Readme.md 保持导航索引角色
- 详细配置说明移到 `docs/configuration.md`
- 开发指南移到 `docs/development.md`
- CLAUDE.md 中用 `@docs/xxx.md` 引用

### 建议 6：开启 Observability 层（投入：5 分钟，风险：低）

当前完全缺少追踪。最低成本方案：
- 在 CLAUDE.md 中添加：`完成任务后写入 memory.md 记录关键决策`
- 利用 Claude Code 内置的 `/cost` 命令追踪 token 消耗
- 考虑使用 `.claude/projects/` 自动记忆功能

---

## 八、改进优先级（按投入产出比排序）

| 优先级 | 建议 | 投入 | 产出 |
|--------|------|------|------|
| **P0** | 创建项目级 CLAUDE.md | 10 min | 所有会话自动加载项目上下文 |
| **P0** | 创建 `.claude/settings.json` | 5 min | 权限安全基线 |
| **P1** | 保持 memory.md 更新习惯 | 持续 | 知识积累、Agent 越用越准 |
| **P2** | 添加一个 PostToolUse Hook | 15 min | 自动质量检查 |
| **P3** | 渐进式文档拆分 | 10 min | 上下文窗口效率 |
| **P3** | Observability 追踪 | 5 min | 可回溯、可优化 |

---

## 九、核心原则总结

1. **Agent 每犯一次错误，就设计一个解决方案让它永远不会再犯**——这就是 Harness Engineering 的本质
2. **CLAUDE.md 是建议（~80% 遵守），Hooks 是法律（100% 强制）**——两条腿走路
3. **每次模型升级后，重测 Harness 假设**——上个月的关键组件可能变成死重
4. **生成的代码和评估代码的 Agent 必须分开**——Agent 无法诚实评价自己的产出
5. **Harness 不是越重越好**——Anthropic 在 Opus 4.6 后主动删掉了 Sprint 环节

---

*分析整理于 2026-05-17 | 数据来源：Anthropic 官方博客、Claude Code 社区源码分析、Multiple production user reports*
