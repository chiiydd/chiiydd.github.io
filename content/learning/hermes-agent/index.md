---
author: "chiiydd"
title: "Hermes Agent 调研：Nous Research 的自我进化 AI Agent 框架"
date: "2026-04-30"
excerpt: "深入调研 Nous Research 开源的 Hermes Agent 框架，分析其架构设计、核心特性、技能系统与学习闭环机制"
tags: [
    "AI Agent",
    "开源框架",
    "Hermes",
    "LLM",
]
---

# Hermes Agent 调研


## 1. 项目概览

Hermes Agent 是由 [Nous Research](https://nousresearch.com) 开源的 AI Agent 框架，目前在 GitHub 上已获得超过 **125K Star**，是当前开源社区中最受关注的 Agent 框架之一。

> **项目口号**：The self-improving AI agent — creates skills from experience, improves them during use, and runs anywhere.

Hermes Agent 的核心理念是**自我进化**——它不仅仅是执行任务的工具，更是一个能够从经验中学习、持续改进的智能体。当前版本为 `v0.11.0`，采用 MIT 协议开源，使用 Python 编写。

**GitHub 仓库**：[NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)
**官方文档**：[hermes-agent.nousresearch.com/docs](https://hermes-agent.nousresearch.com/docs/)


## 2. 核心架构

Hermes Agent 的代码规模约 **303 个 Python 文件**，模块划分清晰。从包结构来看，核心架构包含以下几层：

```
hermes-agent/
├── agent/              # Agent 核心引擎
│   ├── transports/     # LLM Provider 适配层（Anthropic, Bedrock, ChatCompletions, Codex等）
│   ├── context_engine.py    # 上下文引擎
│   ├── memory_manager.py    # 记忆管理
│   ├── prompt_builder.py    # Prompt 构建器
│   ├── skill_utils.py       # 技能工具
│   └── ...
├── tools/              # 工具系统（50+ 工具）
│   ├── terminal_tool.py
│   ├── browser_tool.py
│   ├── file_tools.py
│   ├── delegate_tool.py
│   ├── mcp_tool.py
│   └── ...
├── gateway/            # 消息网关（多平台接入）
│   ├── platforms/      # 平台适配器
│   │   ├── telegram.py
│   │   ├── discord.py
│   │   ├── slack.py
│   │   ├── weixin.py
│   │   ├── whatsapp.py
│   │   └── ...（15+ 平台）
│   ├── delivery.py     # 消息分发
│   └── hooks.py        # 钩子系统
├── cron/               # 定时任务调度器
├── acp_adapter/        # Agent Communication Protocol 适配器
├── tui_gateway/        # 终端 UI 网关
└── cli.py              # CLI 入口
```


### 2.1 Agent 核心引擎

Agent 层是整个框架的大脑，负责：

- **多模型适配**：通过 `transports/` 目录下的适配器支持多种 LLM Provider。包括 Anthropic、AWS Bedrock、OpenAI 兼容接口（ChatCompletions）、Codex、Gemini 等。切换模型只需一行命令 `hermes model`，无需修改代码。
- **上下文管理**：`context_engine.py` 负责管理对话上下文，`context_compressor.py` 处理上下文压缩以应对长对话场景。
- **Prompt 构建**：`prompt_builder.py` 负责组装系统提示、工具描述、记忆注入等。
- **错误处理与重试**：`error_classifier.py` 对错误分类，`retry_utils.py` 实现带退避的重试策略，`rate_limit_tracker.py` 跟踪速率限制。


### 2.2 工具系统

Hermes Agent 拥有丰富的内置工具，以下是核心工具列表：

| 工具 | 文件 | 功能 |
|------|------|------|
| Terminal | `terminal_tool.py` | Shell 命令执行，支持前台/后台进程 |
| Browser | `browser_tool.py` | 浏览器自动化（CDP协议） |
| File Operations | `file_tools.py` | 文件读写、搜索、补丁 |
| Web Search | `web_tools.py` | 网页搜索与爬取 |
| Delegate | `delegate_tool.py` | 子 Agent 分派与并行执行 |
| MCP | `mcp_tool.py` | Model Context Protocol 集成 |
| Memory | `memory_tool.py` | 持久化记忆存储 |
| Skills | `skill_manager_tool.py` | 技能创建与管理 |
| Cron | `cronjob_tools.py` | 定时任务管理 |
| Image Generation | `image_generation_tool.py` | 图片生成（支持多种 Provider） |
| TTS | `tts_tool.py` | 文本转语音 |
| Vision | `vision_tools.py` | 图像分析 |
| Checkpoint | `checkpoint_manager.py` | 状态快照与恢复 |

工具系统支持**权限控制**（`approval.py`）和**路径安全检查**（`path_security.py`、`url_safety.py`），保障执行安全。


### 2.3 消息网关（Gateway）

网关是 Hermes Agent 的"触角"，让它能够活在各种消息平台中：

```
支持的平台（15+）：
├── Telegram
├── Discord
├── Slack
├── WhatsApp
├── WeChat/微信
├── Signal
├── Matrix
├── Mattermost
├── 飞书（Feishu）
├── 企业微信（WeCom）
├── 钉钉（DingTalk）
├── QQ
├── Email
├── SMS
├── Home Assistant
└── Webhook（通用）
```

网关通过一个统一的 `base.py` 基类抽象了消息收发接口，每个平台只需实现适配器即可接入。消息分发由 `delivery.py` 统一管理，支持跨平台的消息路由。


## 3. 自我进化：闭环学习系统

Hermes Agent 最独特的设计在于其**闭环学习系统**，这也是它区别于其他 Agent 框架的核心竞争力。


### 3.1 记忆系统（Memory）

记忆系统是自我进化的基石。Hermes Agent 的记忆分为多个层次：

- **持久化记忆**：通过 `memory_tool.py` 存储用户偏好、环境信息、经验教训。记忆在每次对话的 system prompt 中自动注入，确保跨会话的连续性。
- **会话搜索**：基于 FTS5（SQLite 全文搜索引擎），支持对历史会话的关键词搜索和 LLM 摘要总结。
- **用户建模**：集成 [Honcho](https://github.com/plastic-labs/honcho) 的辩证式用户建模，持续构建对用户偏好和习惯的理解。

```python
# 记忆写入示例（从 prompt 中提取）
memory(target="user", content="用户偏好中文回复，使用 Markdown 格式")
memory(target="memory", content="项目的 CI 使用 GitHub Actions，Hugo 版本 >= 0.128.0")
```


### 3.2 技能系统（Skills）

技能是 Hermes Agent 的"肌肉记忆"。当 Agent 完成一个复杂任务后，它可以将解决过程抽象为一个可复用的技能：

```
~/.hermes/skills/
├── {skill-name}/
│   ├── SKILL.md          # 技能描述（YAML frontmatter + 使用说明）
│   ├── references/       # 参考资料
│   ├── templates/        # 模板文件
│   └── scripts/          # 辅助脚本
```

技能的核心设计：

1. **自动创建**：完成复杂任务（5+ 工具调用）后，Agent 会主动提议将解决方案保存为技能。
2. **使用中改进**：当使用技能遇到问题时，Agent 会立即修补（patch）技能内容，确保技能不断进化。
3. **标准化**：技能兼容 [agentskills.io](https://agentskills.io) 开放标准，支持社区共享。

系统自带了 **20+ 个技能分类**，涵盖：

- Apple 生态（Notes、Reminders、iMessage、FindMy）
- 创意设计（架构图、ASCII 艺术、Excalidraw、Manim 动画、像素艺术）
- 数据科学（Jupyter 内核管理）
- 开发运维（Webhook 订阅）
- 生产力（PowerPoint 制作）
- 智能家居（Home Assistant）
- 社交媒体管理
- 红队测试
- ...


### 3.3 自我进化闭环

将记忆和技能结合，形成了 Hermes Agent 的自我进化闭环：

```
任务执行 → 经验总结 → 技能创建/改进 → 记忆存储
    ↑                                      ↓
    ←────── 下次遇到类似任务时复用 ←────────←
```

具体来说：

1. **经验积累**：每次复杂任务完成后，Agent 将关键信息存入记忆。
2. **技能沉淀**：可复用的解决方案被抽象为技能。
3. **自我改进**：使用技能时发现缺陷，立即修补。
4. **跨会话召回**：通过 FTS5 搜索和记忆注入，在新会话中自动调用相关经验。
5. **定期提醒**：Agent 会主动提醒自己（nudge）持久化重要知识。


## 4. 特色机制深度解析


### 4.1 记忆系统 vs OpenClaw 的 SOUL.md

OpenClaw 使用 `SOUL.md` 文件来定义 Agent 的人格和行为规范。这是一个静态文件，需要用户手动编辑维护。Hermes Agent 在此基础上做了根本性的升级：

**动态记忆注入**：Hermes Agent 的记忆分为 `user`（用户画像）和 `memory`（环境笔记）两个存储目标。每次对话开始时，相关记忆会自动注入到 system prompt 中，无需用户手动管理。

```python
# 用户画像记忆 — 关于"你是谁"
memory(target="user", content="用户偏好中文回复，使用 Markdown 格式")

# 环境记忆 — 关于"世界是什么样"
memory(target="memory", content="项目的 CI 使用 GitHub Actions，Hugo 版本 >= 0.128.0")
```

**记忆分类优先级**：系统对记忆有明确的优先级排序——用户偏好和纠正 > 环境事实 > 流程知识。这意味着当用户说"我不喜欢这样回复"时，这条纠正会优先于其他记忆被考虑。

**可插拔的后端**：除了内置的文件存储，还支持 [Honcho](https://github.com/plastic-labs/honcho)（辩证式用户建模）、Mem0 等外部记忆后端，用户可以根据需求选择。


### 4.2 FTS5 会话搜索与跨会话召回

Hermes Agent 内置了基于 SQLite FTS5 全文搜索引擎的会话搜索能力。这意味着：

- **关键词搜索**：可以搜索过去所有会话中的任何内容
- **LLM 摘要**：搜索结果会经过 LLM 总结，直接返回有用的信息而非原始对话记录
- **主动召回**：当用户提到"我们之前讨论过"、"上次你说"等暗示历史上下文的表述时，Agent 会自动触发搜索

这是 OpenClaw 不具备的能力。OpenClaw 的会话是相对孤立的，跨会话的知识传递主要依赖手动维护的记忆文件。


### 4.3 技能自改进机制

Hermes Agent 的技能系统不只是"保存可复用的过程"，它有一个完整的**自改进循环**：

```
创建技能（完成复杂任务后）
    ↓
使用技能（遇到新场景）
    ↓
发现问题（执行失败或次优）
    ↓
立即修补（patch SKILL.md）
    ↓
技能进化（下次使用更新版本）
```

关键设计决策：

1. **即时修补**：不是等到"下次更新"，而是在使用过程中发现问题就立即修复。这避免了技能腐化（skill rot）。
2. **社区标准化**：技能兼容 [agentskills.io](https://agentskills.io) 开放标准，可以在社区间共享和复用。
3. **结构化存储**：每个技能是一个目录，包含 `SKILL.md`（描述文档）、`references/`（参考资料）、`templates/`（模板）、`scripts/`（脚本），支持复杂的多文件技能。

系统自带 **20+ 个技能分类**，涵盖 Apple 生态、创意设计、数据科学、开发运维、智能家居等领域。


### 4.4 主动记忆持久化（Nudge）

Hermes Agent 有一个独特的"nudge"机制——它会**主动提醒自己**将重要知识持久化。具体来说：

- 当 Agent 在对话中发现了对用户有用的环境信息、偏好或解决方案时，它不会等到用户要求才保存
- 系统会在适当的时候触发 nudge，让 Agent 自主决定是否将当前信息写入记忆或创建技能
- 这使得 Agent 能够在"静默学习"中不断积累对用户的理解

这个机制让 Hermes Agent 从一个"被动执行者"变成了一个"主动学习者"。


### 4.5 状态快照与检查点（Checkpoint）

`checkpoint_manager.py` 实现了 Agent 执行过程中的状态快照：

- 每次重要的工具调用前后，Agent 会自动保存当前状态的快照
- 如果后续执行失败，可以回滚到之前的状态
- 最多保留 50 个快照，防止磁盘空间无限增长

这对于长时间运行的复杂任务（如多文件重构、大规模数据处理）尤为重要。


### 4.6 凭证池与速率限制

Hermes Agent 通过 `credential_pool.py` 和 `rate_limit_tracker.py` 实现了智能的 API 管理：

- **凭证池**：支持配置多个 API Key，系统自动轮转使用，避免单个 Key 触发速率限制
- **速率限制跟踪**：实时跟踪每个 Provider 的速率限制状态，在接近限制时自动切换
- **故障分类**：`error_classifier.py` 对错误进行分类，区分临时故障和永久错误，决定是否重试


### 4.7 上下文压缩

面对长对话场景，Hermes Agent 通过两层压缩机制保持效率：

- **上下文压缩**（`context_compressor.py`）：当对话接近上下文窗口限制时，自动压缩历史消息，保留关键信息
- **轨迹压缩**（`trajectory_compressor.py`）：压缩工具调用的中间结果，只保留最终有效输出

这确保了 Agent 在数小时的持续交互中不会因为上下文窗口溢出而丢失关键上下文。


### 4.8 多实例配置（Profiles）

Hermes Agent 支持通过 Profiles 运行多个独立的 Agent 实例：

```bash
hermes --profile work          # 工作配置（使用 Claude）
hermes --profile personal      # 个人配置（使用本地模型）
```

每个 Profile 拥有独立的配置、会话历史、技能和记忆，互不干扰。这对于需要在不同场景（工作/个人/测试）下使用不同配置的用户非常实用。


## 5. Hermes Agent vs OpenClaw

Hermes Agent 与 OpenClaw 属于同一赛道——都是运行在终端和消息平台上的个人 AI 助手。但它们在设计理念和实现方式上有显著差异。


### 5.1 关系与背景

[OpenClaw](https://github.com/openclaw/openclaw)（366K+ Star）是一个社区驱动的开源项目，原名 ClawdBot/Moltbot，定位为"个人 AI 助手"。Hermes Agent 由 [Nous Research](https://nousresearch.com) 开发，属于同一品类但独立实现的项目。

Hermes Agent 提供了从 OpenClaw 迁移的工具：

```bash
hermes claw migrate              # 交互式迁移（完整预设）
hermes claw migrate --dry-run    # 预览迁移内容
hermes claw migrate --preset user-data   # 仅迁移用户数据（不含密钥）
```

迁移工具会导入 SOUL.md、记忆、技能、命令白名单、消息平台配置、API Key 等。


### 5.2 核心差异对比

| 维度 | OpenClaw | Hermes Agent |
|------|----------|--------------|
| **记忆机制** | 静态文件（SOUL.md / MEMORY.md / USER.md），手动维护 | 动态记忆注入 + 自动 nudge + 可插拔后端（Honcho、Mem0） |
| **会话搜索** | 无内置跨会话搜索 | FTS5 全文搜索 + LLM 摘要总结 |
| **技能系统** | 静态技能文档，需手动更新 | 自改进循环：使用中发现问题立即修补，兼容 agentskills.io 标准 |
| **语言实现** | TypeScript/Node.js | Python |
| **自我进化** | 无内置学习闭环 | 完整的执行→学习→进化闭环 |
| **状态管理** | 无检查点机制 | 自动快照 + 回滚（最多 50 个检查点） |
| **上下文管理** | 基础 | 双层压缩（上下文 + 轨迹） |
| **多实例** | 无内置 Profile 支持 | Profiles 隔离多实例 |
| **平台支持** | 25+ 平台（TypeScript 生态） | 15+ 平台（Python 生态） |


### 5.3 设计哲学的不同

**OpenClaw 的设计哲学**是"做一个好的个人助手"——它强调的是接入渠道的广泛性（25+ 消息平台）和社区生态的丰富性（5400+ 技能）。它更像一个"产品"，用户通过配置 SOUL.md 和安装技能来定制行为。

**Hermes Agent 的设计哲学**是"做一个会成长的助手"——它强调的是学习闭环和自我进化。记忆不是静态配置，而是动态积累的；技能不是安装的，而是在使用中诞生和进化的。它更像一个"生物"，会随着交互不断适应用户。

这种哲学差异体现在代码层面：

- OpenClaw 的核心是 **Gateway + SOUL.md + Skills**——一个消息路由 + 人格定义 + 能力扩展的组合
- Hermes Agent 的核心是 **Agent Loop + Memory + Skills + Session Search**——一个任务执行 + 经验积累 + 能力进化 + 知识召回的闭环


### 5.4 适用场景

- 选择 **OpenClaw**：如果你需要快速搭建一个接入多平台的 AI 助手，社区技能丰富，上手门槛低
- 选择 **Hermes Agent**：如果你需要一个能长期使用、持续学习的助手，重视跨会话的知识积累，或者在 Python 生态中工作


## 6. 部署与运行模式

Hermes Agent 的另一大特色是**灵活的部署方式**：


### 5.1 本地 CLI 模式

最简单的使用方式，直接在终端中交互：

```bash
hermes chat                     # 启动交互式对话
hermes chat --resume SESSION    # 恢复之前的会话
hermes chat --skills skill1 skill2  # 加载指定技能
```


### 5.2 网关模式

后台运行网关进程，通过消息平台与 Agent 交互：

```bash
hermes gateway start            # 启动网关
hermes gateway status           # 查看状态
```

网关模式下，Agent 可以同时接入多个平台。你可以在 Telegram 上给它发消息，它在 Discord 上回复结果——一切都是同一个 Agent 实例。


### 5.3 定时任务模式

内置 cron 调度器，支持自然语言定义的定时任务：

```bash
hermes cron list                # 查看所有定时任务
hermes cron create "每天早上9点发一份新闻摘要" --schedule "0 9 * * *"
```


### 5.4 沙箱化执行

终端执行支持多种隔离环境：

| 环境 | 文件 | 说明 |
|------|------|------|
| Local | `local.py` | 本地直接执行 |
| Docker | `docker.py` | Docker 容器隔离 |
| SSH | `ssh.py` | 远程 SSH 执行 |
| Modal | `modal.py` | Serverless 云端执行 |
| Singularity | `singularity.py` | HPC 容器 |
| Daytona | `daytona.py` | 云端开发环境 |

这意味着你可以在 $5 的 VPS 上运行，也可以在 GPU 集群或 Serverless 基础设施上部署。


## 7. 社区生态

Hermes Agent 的开源社区非常活跃，围绕主仓库衍生出了丰富的生态项目：

| 项目 | Stars | 说明 |
|------|-------|------|
| [hermes-agent-orange-book](https://github.com/alchaincyf/hermes-agent-orange-book) | 3.4K | 《Hermes Agent 从入门到精通》橙皮书系列 |
| [hermes-agent-self-evolution](https://github.com/NousResearch/hermes-agent-self-evolution) | 2.6K | 基于 DSPy + GEPA 的自我进化优化 |
| [awesome-hermes-agent](https://github.com/0xNyk/awesome-hermes-agent) | 2.1K | 精选技能、工具和资源列表 |
| [hermes-agent-guide](https://github.com/jwangkun/hermes-agent-guide) | 121 | 16 册 30 万字中文指南 |
| [learn-hermes-agent](https://github.com/longyunfeigu/learn-hermes-agent) | 72 | 27 章从零构建 Agent 的教程 |
| [hermes-agent-rs](https://github.com/Lumio-Research/hermes-agent-rs) | 24 | Rust 重写版本，单二进制文件 |

中文社区尤其活跃，出现了大量中文教程和指南，说明 Hermes Agent 在国内 AI 开发者中有很高的关注度。


## 8. 设计亮点与思考


### 8.1 值得学习的设计决策

**1. 工具抽象层的设计**

Hermes Agent 的工具注册采用统一的 `registry.py` 管理，每个工具都是独立模块，通过 toolset 机制进行分组和权限控制。这种设计使得工具的增删非常灵活，不会影响核心引擎。

**2. 网关的平台抽象**

消息平台适配器基于 `base.py` 基类，每个平台只需实现几个关键方法即可接入。新增平台的工作量极低，这也是为什么它能支持 15+ 平台的原因。

**3. 技能的自改进机制**

技能不是静态文档，而是会随着使用不断进化。`patch` 操作允许 Agent 在使用技能时发现问题后立即修复，避免了技能腐化（skill rot）。

**4. 上下文压缩**

面对长对话场景，`context_compressor.py` 负责压缩上下文，`trajectory_compressor.py` 压缩工具调用轨迹。这确保了 Agent 在长时间交互中不会因上下文窗口溢出而丢失关键信息。


### 8.2 潜在的挑战

**1. Token 消耗**

自我进化机制（记忆注入、技能加载、会话搜索）会增加每次请求的 Token 消耗。对于昂贵的模型（如 Claude Opus），这可能带来较高的使用成本。

**2. 技能质量控制**

自动创建的技能质量参差不齐。如果 Agent 基于一次偶然的成功就创建技能，可能会固化错误的模式。社区中的 `hermes-agent-self-evolution` 项目（基于 DSPy + GEPA）正是为了解决这个问题。

**3. 安全性**

Agent 拥有终端执行、文件操作、浏览器控制等高权限能力。虽然有 `approval.py`、`path_security.py` 等安全机制，但在 `--yolo` 模式下这些检查会被跳过，需要用户自行承担风险。


## 9. 总结

Hermes Agent 是目前开源 AI Agent 框架中设计理念最完整的一个。它的核心竞争力不在于某一个单独的功能，而在于**闭环**：

- **执行 → 学习 → 进化** 的自我提升闭环
- **本地 CLI → 消息网关 → 定时任务** 的全场景闭环
- **记忆 → 技能 → 会话搜索** 的知识管理闭环

对于想要深入 AI Agent 开发的开发者来说，Hermes Agent 是一个非常好的学习对象。相比 OpenClaw 的"产品化"路线，Hermes Agent 走了一条更具学术气质的"自我进化"路线。它的架构清晰、代码质量高、社区活跃，无论是研究其设计理念还是直接使用（甚至二次开发），都是值得投入时间的选择。
- [OpenClaw GitHub 仓库](https://github.com/openclaw/openclaw)

> ⚠️ 本文基于 Hermes Agent v0.11.0 进行调研，项目仍在快速迭代中，部分细节可能随版本更新而变化。


## 参考资料

- [Hermes Agent GitHub 仓库](https://github.com/NousResearch/hermes-agent)
- [Hermes Agent 官方文档](https://hermes-agent.nousresearch.com/docs/)
- [Nous Research 官网](https://nousresearch.com)
- [agentskills.io 开放标准](https://agentskills.io)
- [Honcho 用户建模](https://github.com/plastic-labs/honcho)
- [Hermes Agent Self-Evolution](https://github.com/NousResearch/hermes-agent-self-evolution)
- [Hermes Agent 橙皮书](https://github.com/alchaincyf/hermes-agent-orange-book)
