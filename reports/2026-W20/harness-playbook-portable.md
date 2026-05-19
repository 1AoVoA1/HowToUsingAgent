# Claude Code Harness 通用落地手册

> 适用场景：新项目初始化 / 旧项目改造 / 团队推广。目标读者：你自己和你的同事。

---

## 一、新项目 15 分钟 Harness 启动清单

按顺序执行，每一步 3-5 分钟：

```
□ 1. touch CLAUDE.md           ← 项目记忆层
□ 2. mkdir .claude && 配置      ← 权限 + 规则 + Hooks
□ 3. touch memory.md            ← 踩坑记录
□ 4. 加 .claudeignore           ← 上下文减噪
□ 5. git commit -m "init harness"
```

### 步骤 1：创建 CLAUDE.md（项目级，~50-80 行）

用这个模板填空：

```markdown
# [项目名]

## 项目一句话
[一句话说清项目做什么、给谁用]

## 技术栈
[语言、框架、数据库、部署平台]

## 常用命令
- 启动开发环境：[命令]
- 运行测试：[命令]
- 构建：[命令]
- Lint/格式化：[命令]

## 目录结构
- [目录A] → [用途]
- [目录B] → [用途]
- [目录C] → [用途]

## 编码约定
[3-5 条非默认规范，不要写"写干净代码"这种废话]
- [具体规则]
- [具体规则]

## 不做什么
[Claude 容易犯的错，提前禁止]
- [禁止行为]
- [禁止行为]

## 外部文档
- @docs/architecture.md
```

**自我审查**：逐行问"删掉这行，Claude 会犯错吗？"——不会就删。

### 步骤 2：创建 `.claude/settings.json`

```json
{
  "permissions": {
    "allow": [
      "Bash(npm *)",
      "Bash(git *)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)",
      "Read(./credentials/**)",
      "Bash(curl *)",
      "Bash(rm -rf *)"
    ]
  }
}
```

**万能 deny 规则**（每个项目都该有）：
- `Read(./.env)` 和 `Read(./.env.*)`：防密钥泄露
- `Read(./secrets/**)` 和 `Read(./credentials/**)`：防配置泄露
- `Bash(rm -rf *)`：防误删

**按项目替换 allow 规则**：
- Python 项目 → `Bash(pytest *)`、`Bash(python *)`
- Node 项目 → `Bash(npm *)`、`Bash(npx *)`
- Go 项目 → `Bash(go *)`
- Rust 项目 → `Bash(cargo *)`

### 步骤 3：创建 memory.md（项目级记忆）

```markdown
# 项目记忆

## 初始化
- 日期：[YYYY-MM-DD]
- 技术选型理由：[为什么选这个栈]

## 踩坑记录
| 日期 | 问题 | 根因 | 解决方案 |
|------|------|------|----------|
| - | - | - | - |

## 关键决策
| 日期 | 决策 | 理由 | 权衡 |
|------|------|------|------|
| - | - | - | - |

## 常用技巧
[项目特有的高效操作方式]
```

### 步骤 4：创建 `.claudeignore`

```
node_modules/
.venv/
__pycache__/
dist/
build/
.next/
*.lock
*.min.js
*.min.css
coverage/
*.log
.git/
.env
.env.*
secrets/
credentials/
```

**作用**：这些文件不进 Context Window，节省 token。

### 步骤 5：提交

```bash
git add CLAUDE.md .claude/ .claudeignore memory.md
git commit -m "init harness: CLAUDE.md + settings + memory"
```

---

## 二、逐层递进的 Harness 演进路线

```
阶段 0：裸跑（无配置）
    ↓ 15 分钟
阶段 1：基础 Harness（CLAUDE.md + settings.json + memory.md）
    ↓ 1-2 周使用，自然积累
阶段 2：中级 Harness（+ Hooks + .claude/rules/）
    ↓ 随项目复杂度触发
阶段 3：高级 Harness（+ Skills + MCP + 多Agent协作）
```

### 何时进入下一阶段

| 信号 | 对应动作 |
|------|----------|
| Claude 反复犯同一类错误 | 加一条 `.claude/rules/*.md` 规则 |
| Claude 跳过必做的检查 | 加一个 PostToolUse Hook |
| 某类操作每次都要手动审批 | 加到 settings.json allow |
| 一段知识在多个会话重复讲解 | 写成 Skill |
| 项目太大 CLAUDE.md 超 200 行 | 拆分为 `@docs/` 引用 |
| 需要 Claude 访问数据库/API | 加 MCP Server |

**核心原则**：不是提前搭好所有东西，而是**Agent 错一次，加一层防御**。

---

## 三、旧项目改造策略

老项目和新项目不同——代码库已经存在，CLAUDE.md 需要"反向工程"。

### 三步改造法

**第 1 步：让 Claude 自己写 CLAUDE.md 初稿**（10 分钟）

在项目目录下对 Claude Code 说：

> 扫描这个项目的目录结构、package.json、配置文件、和最近 20 个 git commit，生成一份 CLAUDE.md 初稿。包括：项目用途、技术栈、常用命令、目录结构、编码约定。控制在 80 行以内。

然后**人工精炼**——删掉 Claude 读代码就能推断的内容。

**第 2 步：从 git log 提取踩坑记录**（5 分钟）

> 查看最近 50 个 commit message 和对应的 diff，找出哪些改动是在"修复问题"或"回滚"，总结成 memory.md 的踩坑记录。

**第 3 步：从现有配置生成 settings.json**（5 分钟）

- 看 `.gitignore` → 把敏感文件路径填入 deny
- 看 `package.json` scripts → 把测试/lint/build 命令填入 allow
- 看 CI 配置 → 把 CI 中运行的检查复制为 Hooks

---

## 四、团队推广策略

### 最小阻力路径

```
1. 你自己先用     → 积累 2 周经验
2. 选一个同事试点  → 帮他建 CLAUDE.md（30 分钟 pair）
3. 对比效果        → 有/无 Harness 的差异（速度、质量、返工率）
4. 推广             → PR 中带 CLAUDE.md 成为默认实践
```

### 给 Leader 的话术

> "我们每次花 15 分钟给 Claude Code 配个 CLAUDE.md + settings.json，之后每个使用它的人（包括新同事）都能直接获得项目上下文和安全边界。投入 15 分钟，收益持续整个项目生命周期。"

### 给同事的话术

> "我帮你花 10 分钟给这个项目配个 CLAUDE.md，之后 Claude Code 就知道你这项目的测试命令、目录结构、代码风格了。不用每次都解释一遍。"

### 团队级共享配置

```
项目仓库/
├── CLAUDE.md              ← 团队共享，签入 git，PR review
├── .claude/
│   ├── settings.json       ← 团队共享权限基线，签入 git
│   ├── settings.local.json ← 个人覆盖，.gitignore 忽略
│   └── rules/
│       ├── security.md      ← 安全规则（deny 模式等）
│       ├── testing.md       ← 测试规范
│       └── style.md         ← 代码风格
└── .claudeignore
```

---

## 五、跨项目一致性维护

当你同时维护多个项目时，保持 Harness 风格一致：

### 用户级 CLAUDE.md（~/.claude/CLAUDE.md）

放**跨项目通用**的偏好——你已经在做了：

```markdown
## 关于我
[角色、偏好]

## 沟通方式
[语言、风格]

## 通用工程纪律
[安全底线、质量规则：适用所有项目]
```

### 项目级 CLAUDE.md

放**仅这个项目特有**的信息：技术栈、目录结构、该项目的约定。

### 判断标准

> 这条规则在所有项目都适用吗？是 → 用户级 CLAUDE.md。否 → 项目级 CLAUDE.md。

---

## 六、效果衡量

用这几个简单指标判断 Harness 是否有效：

| 指标 | 好的信号 | 差的信号 |
|------|----------|----------|
| 返工率 | Claude 第一次就做对 | 同样的问题反复出现 |
| 审批疲劳 | 大部分操作自动通过 | 每个命令都要手动点批准 |
| 上下文重复 | 不用每次都解释项目 | 每次新会话都要长篇描述 |
| CLAUDE.md 长度 | 稳定在 80-150 行 | 持续膨胀（说明没做渐进式披露） |

---

## 七、一页纸速查表

**保存这张表，开新项目时过一遍：**

```
□ CLAUDE.md         ← 项目记忆（签入 git）
□ settings.json     ← 权限基线（签入 git）
□ settings.local.json ← 个人覆盖（不签入）
□ .claudeignore     ← 上下文减噪
□ memory.md         ← 踩坑记录
□ .claude/rules/    ← 专项规则（可选，随需求添加）
□ docs/             ← 详细文档（被 CLAUDE.md @引用）
```

**什么时候加什么：**

```
Agent 犯错 → rules 或 memory.md
Agent 跳过检查 → Hook
Agent 反复问权限 → settings.json allow
Agent 需要新能力 → Skill 或 MCP
Context Window 不够用 → Sub-Agent
```

---

*这是一份可迁移的通用手册。每做一个新项目，打开这份文档，15 分钟内完成阶段 1。—— 2026-05-17*
