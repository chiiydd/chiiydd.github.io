---
author: "chiiydd"
title: "Hermes Agent 调研：它和 OpenClaw 到底有什么不同？"
date: "2026-04-30"
excerpt: "从源码和机制出发，分析 Hermes Agent 相比 OpenClaw 的核心差异化设计"
tags: [
    "AI Agent",
    "开源框架",
    "Hermes",
    "OpenClaw",
]
---

# Hermes Agent 调研：它和 OpenClaw 到底有什么不同？


## 1. 引言

[Hermes Agent](https://github.com/NousResearch/hermes-agent)（125K+ Star）和 [OpenClaw](https://github.com/openclaw/openclaw)（366K+ Star）是当前开源 AI Agent 赛道中最受关注的两个项目。它们都定位为"个人 AI 助手"——运行在终端和消息平台上，拥有工具调用能力，能帮你完成实际任务。

但如果你仔细看它们的代码和文档，会发现一个关键区别：

> **OpenClaw 是一个产品。Hermes 是一个学习系统。**

OpenClaw 的设计目标是"做一个好用的助手"——接入渠道多（25+ 平台）、社区技能丰富（5400+）、上手门槛低。你配置好 SOUL.md，装几个技能，它就开始工作了。

Hermes Agent 的设计目标是"做一个会成长的助手"——它不只是执行任务，还会从每次交互中学习，把经验沉淀为技能，在使用中不断改进这些技能，并且越来越了解你。

本文聚焦分析 Hermes Agent 的核心差异化机制。


## 2. 架构概览

Hermes Agent 由 [Nous Research](https://nousresearch.com) 开发，Python 实现，MIT 协议，当前版本 `v0.11.0`。代码规模约 303 个 Python 文件，核心入口 `run_agent.py` 约 13,700 行。

```
hermes-agent/
├── agent/              # 核心引擎（prompt 构建、上下文压缩、记忆管理）
│   ├── transports/     # LLM Provider 适配层
│   └── ...
├── tools/              # 工具系统（61 个工具，52 个 toolset）
│   ├── execute_code    # Python RPC 脚本执行
│   ├── delegate_tool   # 子 Agent 分派
│   └── ...
├── gateway/            # 消息网关（15+ 平台适配器）
├── cron/               # 定时任务调度器
├── acp_adapter/        # Agent Communication Protocol
└── cli.py              # CLI 入口
```


## 3. 核心差异化：学习闭环

Hermes Agent 最核心的设计是它的**学习闭环**。这不是一个可选的插件，而是贯穿整个系统架构的设计理念。


### 3.1 记忆的 Nudge 机制

OpenClaw 的记忆系统基于静态文件（`SOUL.md`、`MEMORY.md`、`USER.md`），需要用户手动编辑或通过命令更新。Agent 本身不会主动去"记住"什么。

Hermes Agent 的记忆系统有一个关键设计——**Nudge（主动提醒）**。

在 Hermes 的 system prompt 中，有一段专门的指令告诉 Agent：

- 当你发现了对用户有用的环境信息、偏好或解决方案时，**主动**使用 memory 工具保存
- 当用户纠正你时，**立即**记录下来，确保下次不会再犯
- 记忆有优先级：用户偏好和纠正 > 环境事实 > 流程知识

这意味着 Hermes Agent 不是被动地等待用户说"记住这个"，而是会在对话过程中**自主判断**哪些信息值得持久化。

记忆分为两个存储目标：

| 目标 | 文件 | 内容 | 字符限制 |
|------|------|------|----------|
| `user` | `USER.md` | 用户画像——偏好、沟通风格、期望 | 1,375 字符 |
| `memory` | `MEMORY.md` | 环境笔记——项目约定、工具特性、经验教训 | 2,200 字符 |

每次新会话开始时，这些记忆会作为"冻结快照"注入到 system prompt 中。Agent 在会话中修改记忆时，变更会立即持久化到磁盘，但要到下次会话才会出现在 system prompt 中——这是刻意的设计，保护了 LLM 的 prefix cache。


### 3.2 FTS5 跨会话搜索

这是 Hermes Agent 相比 OpenClaw 最显著的能力差距。

Hermes Agent 内置了基于 SQLite FTS5 的全文搜索引擎，索引所有历史会话。Agent 可以通过 `session_search` 工具：

- **关键词搜索**：搜索过去所有会话中的任何内容
- **LLM 摘要**：搜索结果经过 LLM 总结，直接返回有用信息而非原始对话
- **主动触发**：当用户提到"我们之前讨论过"、"上次你说"等暗示历史上下文的表述时，Agent 会自动触发搜索

OpenClaw 的会话是相对孤立的。跨会话的知识传递完全依赖手动维护的记忆文件。这意味着如果你在三个月前讨论过一个技术方案，OpenClaw 不会"想起来"，除非你手动把它写进 MEMORY.md。

Hermes Agent 的 FTS5 搜索让它拥有了"回忆"的能力——不是你告诉它记住的，而是它自己能翻阅过去的对话找到相关信息。


### 3.3 技能的自改进循环

OpenClaw 和 Hermes 都有技能系统，但设计理念完全不同。

**OpenClaw 的技能**是静态文档。你从社区安装一个技能，它就固定在那里。如果技能有 bug 或者不适用于你的场景，你需要手动修改或等社区更新。

**Hermes 的技能**是活的。它有一个完整的自改进循环：

```
完成复杂任务 → 自动提议创建技能
                    ↓
            使用技能处理新场景
                    ↓
            发现问题（执行失败或次优）
                    ↓
            立即修补 SKILL.md（patch 操作）
                    ↓
            技能进化，下次使用更新版本
```

关键设计决策：

1. **即时修补**：不是等到"下次更新"，而是在使用过程中发现问题就立即修复。这避免了技能腐化（skill rot）。
2. **结构化存储**：每个技能是一个目录，包含 `SKILL.md`（描述文档）、`references/`（参考资料）、`templates/`（模板）、`scripts/`（脚本），支持复杂的多文件技能。
3. **渐进式加载**：技能采用三级加载策略（摘要 → 全文 → 引用文件），最小化 Token 消耗。

更进一步，Nous Research 还有一个配套项目 [hermes-agent-self-evolution](https://github.com/NousResearch/hermes-agent-self-evolution)，使用 DSPy + GEPA（遗传帕累托提示进化）来自动优化技能、工具描述和系统提示。这是一个基于进化算法的自动化优化流程，不需要 GPU 训练，每次优化成本约 $2-10。


### 3.4 Honcho 辩证式用户建模

Hermes Agent 集成了 [Honcho](https://github.com/plastic-labs/honcho)——一个辩证式用户建模系统。

普通的用户建模是线性的：记录用户说了什么，然后在下次对话中引用。Honcho 的方式不同：它通过对话历史推断用户的认知模式、决策偏好和沟通习惯，构建一个不断深化的用户画像。

这意味着 Hermes Agent 不只是记住"用户喜欢简洁回复"，而是逐渐理解"用户在什么场景下需要详细解释，什么场景下需要快速结论"。


## 4. 核心差异化：执行能力


### 4.1 execute_code：Python RPC 脚本

Hermes Agent 有一个独特的 `execute_code` 工具——Agent 可以编写 Python 脚本，在脚本中通过 RPC 调用其他工具（`read_file`、`write_file`、`terminal`、`search_files`、`patch`）。

```
普通 Agent 的工作方式：
  工具调用1 → 等待结果 → 工具调用2 → 等待结果 → 工具调用3 → ...

Hermes 的 execute_code 方式：
  编写一个 Python 脚本，在脚本中连续调用多个工具
  → 一次执行，零上下文消耗
```

这个设计的价值在于：当你需要执行 10 个文件的批量修改、循环处理数据、或者有条件分支的复杂逻辑时，Agent 不需要在上下文中传递每一步的中间结果。它把整个流程写成一个 Python 脚本，一次执行完毕，只返回最终结果。

这对于上下文窗口是稀缺资源的 LLM 来说，是一个非常实用的优化。


### 4.2 子 Agent 分派（Delegate）

`delegate_tool` 允许 Hermes Agent 生成独立的子 Agent 来并行处理任务。每个子 Agent 拥有独立的对话上下文和工具集。

典型场景：你需要调研三个不同的技术方案。主 Agent 可以同时派出三个子 Agent，每个负责一个方案的调研，最后汇总结果。子 Agent 的中间过程不会污染主 Agent 的上下文。


### 4.3 状态快照与检查点

`checkpoint_manager` 在每次重要工具调用前后保存状态快照。如果后续执行失败，可以回滚到之前的状态。最多保留 50 个快照。

这对于长时间运行的复杂任务（多文件重构、大规模数据处理）尤为重要——你不需要从头开始。


## 5. 核心差异化：研究导向


### 5.1 轨迹系统与 RL 训练

Hermes Agent 的代码中有一个 `batch_runner.py` 和 `trajectory.py`，以及 `Atropos RL` 环境的集成。这不是偶然的功能——它是 Hermes Agent 作为 Nous Research 研究基础设施的一部分。

Nous Research 是一家专注于 AI 研究的机构，他们开发 Hermes Agent 不只是为了做一个好用的工具，更是为了：

1. **收集高质量的工具调用轨迹**：Agent 在实际使用中的每一次工具调用、每一个决策都是宝贵的训练数据。
2. **训练下一代工具调用模型**：通过 RL（强化学习）优化模型的工具使用能力。
3. **验证自进化假设**：通过 self-evolution 项目验证"Agent 能否通过进化算法自我改进"。

这意味着 Hermes Agent 的用户实际上在参与一个大规模的 AI 研究实验——你的使用数据（经过脱敏）可以帮助训练更好的 Agent 模型。


### 5.2 可插拔的上下文引擎

`context_engine.py` 是一个抽象基类（ABC），允许不同的上下文压缩策略。默认实现 `context_compressor.py` 使用有损摘要压缩，但你可以实现自己的压缩策略。

这种设计体现了研究导向的思维方式——不同的压缩策略可能在不同场景下表现更好，开放接口让研究者可以实验新的方法。


## 6. 与 OpenClaw 的对比总结

| 维度 | OpenClaw | Hermes Agent |
|------|----------|--------------|
| **定位** | 个人 AI 助手（产品） | 自我进化的 AI Agent（研究系统） |
| **语言** | TypeScript/Node.js | Python |
| **记忆** | 静态文件，手动维护 | 动态注入 + Nudge 主动持久化 |
| **会话搜索** | 无 | FTS5 全文搜索 + LLM 摘要 |
| **技能** | 静态文档，社区安装 | 自改进循环，使用中即时修补 |
| **用户建模** | 基础 | Honcho 辩证式建模 |
| **执行优化** | 标准工具调用 | execute_code RPC + 子 Agent 分派 |
| **研究集成** | 无 | 轨迹系统 + RL 训练 + 自进化 |
| **平台数量** | 25+ | 15+ |
| **社区规模** | 366K Star | 125K Star |


## 7. 适用场景

**选择 OpenClaw**：
- 你需要快速搭建一个多平台 AI 助手
- 你偏好 TypeScript/Node.js 生态
- 你想要丰富的社区技能库（5400+）
- 你需要最广泛的平台支持（25+）

**选择 Hermes Agent**：
- 你需要一个能长期使用、持续学习的助手
- 你重视跨会话的知识积累和回忆能力
- 你偏好 Python 生态
- 你对 AI Agent 的研究和进化机制感兴趣
- 你需要复杂的多步骤任务自动化（execute_code + delegate）


## 8. 总结

Hermes Agent 的核心竞争力不在于"功能更多"或"平台更广"——OpenClaw 在这些方面做得更好。

Hermes 的核心竞争力在于**它会学习**。

记忆的 Nudge 机制让 Agent 主动积累对用户的理解；FTS5 搜索让 Agent 能回忆过去的对话；技能的自改进循环让 Agent 的能力随时间增长；Honcho 用户建模让 Agent 越来越懂你。

这不是一个功能列表，而是一个**飞轮**：用得越多，Agent 越了解你，技能越完善，任务完成得越好，你越愿意用。

对于 AI Agent 领域的研究者和开发者来说，Hermes Agent 提供了一个难得的研究平台——它不仅是一个可用的工具，更是一个可以观察"Agent 如何自我进化"的实验环境。

> ⚠️ 本文基于 Hermes Agent v0.11.0 调研，项目仍在快速迭代中。


## 参考资料

- [Hermes Agent GitHub 仓库](https://github.com/NousResearch/hermes-agent)
- [OpenClaw GitHub 仓库](https://github.com/openclaw/openclaw)
- [Hermes Agent 官方文档](https://hermes-agent.nousresearch.com/docs/)
- [Hermes Agent Self-Evolution](https://github.com/NousResearch/hermes-agent-self-evolution)
- [Honcho 用户建模](https://github.com/plastic-labs/honcho)
- [agentskills.io 开放标准](https://agentskills.io)
- [Hermes Agent 橙皮书](https://github.com/alchaincyf/hermes-agent-orange-book)
