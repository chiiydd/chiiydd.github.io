---
title: "多 Agent 协同开发实践：从 Hermes 到 Codex+Claude Code 的探索"
date: 2026-04-30T22:00:00+08:00
draft: false
tags: ["AI", "Multi-Agent", "Rust", "Hermes", "Codex", "Claude Code", "TUI"]
categories: ["技术学习"]
summary: "通过一个 Rust TUI 网易云播放器项目，实践多 Agent 协同开发，总结任务拆分、角色分工、工具调优的真实经验。"
---

## 背景

在深度调研了 Hermes Agent 的架构后，我们决定通过一个实际项目来验证多 Agent 协同开发的可行性。项目是一个 Rust TUI 网易云音乐播放器（netune），采用 Cargo Workspace 架构，分为 4 个 crate：

```
netune-tui-player/
├── crates/
│   ├── netune-core/     # 核心 traits + 数据模型
│   ├── netune-api/      # API 客户端 + 加密
│   ├── netune-player/   # 音频播放 + 队列
│   └── netune-tui/      # ratatui 界面层
```

## 角色分工

| Agent | 角色 | 负责模块 |
|-------|------|----------|
| **Hermes** | 项目总管 | 架构设计、接口定义、任务拆分、代码 Review、集成 |
| **Codex (A组)** | 底层开发者 | API 客户端、加密模块、登录逻辑 |
| **Claude Code (B组)** | UI 开发者 | TUI 页面、组件、交互逻辑 |
| **delegate_agent** | 后备力量 | 补位执行，不分前后端 |

## 开发时间线

```
Phase 1 - 骨架搭建 (Hermes)
  └── 创建 4 个 crate、定义 trait 接口、数据模型
  └── cargo check 通过

Phase 2 - 并行开发
  ├── Claude Code: home.rs + search.rs + playlist.rs    ← 快速稳定
  ├── Codex: login_phone + crypto                       ← 有波折但完成
  └── Hermes: crypto 加密模块

Phase 3 - 补位推进
  ├── delegate_agent: search_songs + song_url           ← 最终稳定方案
  ├── delegate_agent: login.rs + settings.rs
  └── delegate_agent: player + queue (播放器核心)

Phase 4 - 集成收尾
  ├── delegate_agent: 修复 serde rename + unused imports
  ├── delegate_agent: app.rs 集成 API/Player/页面串联
  └── delegate_agent: 修复 Rust 2024 borrow checker 规则

最终：10 个 commit，4327 行 Rust 代码，cargo check 全部通过
```

## 经验总结

### 1. 工具选择：没有银弹，但有最优解

我们尝试了三种调用 Agent 的方式：

| 方式 | 优点 | 缺点 |
|------|------|------|
| `codex exec` (CLI) | 非交互式，好集成 | **经常超时（>240s）**，尤其是大任务 |
| `claude -p` (CLI) | 非交互式 | 偶尔被 block，参数格式敏感 |
| `delegate_task` (Hermes) | **最稳定**，120-280s 完成 | 子 agent 没有对话记忆 |

**结论：`delegate_task` 是最优选择**。它比直接跑 CLI 稳定得多，因为 Hermes 的调度层处理了超时、重试等问题。

### 2. 任务粒度：越细越好

**失败案例：** 让 Codex 一次实现整个 `client.rs`（12 个 API 方法）→ 超时。

**成功案例：** 拆成单函数级别：
- `login_phone` 一个方法 → Codex 完成 ✅
- `search_songs` + `song_url` 两个方法 → delegate_agent 完成 ✅
- 剩余 9 个方法打包 → delegate_agent 完成 ✅（但需要注意同文件冲突）

**经验法则：**
- 单个 agent 单次任务：**1-3 个函数** 或 **1 个页面**
- 避免让两个 agent 同时改同一个文件
- 大模块（>500行）拆成多个阶段

### 3. 并行 vs 串行：巧妙避冲突

```
✅ 正确的并行：
  Agent A → 改 client.rs (API层)
  Agent B → 改 login.rs (TUI层)
  → 无文件冲突，各自提交

❌ 危险的并行：
  Agent A → 改 client.rs
  Agent B → 改 client.rs
  → 后写的覆盖先写的，丢失改动
```

**经验：** 按文件分配任务，而不是按功能。如果必须改同一个文件，串行执行。

### 4. delegate_agent 的"超能力"

一个意外发现：delegate_agent 在完成主任务后，会**自动修补相关文件**。

例如，让它实现 `search_songs` 和 `song_url` 时，它还主动：
- 修补了 `models.rs` 中缺失的响应结构体
- 调整了 TUI 页面中 Page trait 的适配
- 添加了 `Cargo.toml` 中缺少的依赖

这是好事也是坏事——**好事**是减少了人工干预，**坏事**是改动范围可能超出预期，需要仔细 review diff。

### 5. Commit 规范：追踪贡献者

我们在 commit message 中标注了主要贡献者：

```
feat(api): 实现 AES-128-ECB 加密模块 (Hermes)
feat(api): 实现 login_phone 手机号登录 (Codex)
feat(tui): 实现 home 主菜单 + search 搜索页面 (Claude Code)
feat(tui): 实现 player 播放页面 (delegate_agent)
```

这在多人/多 Agent 协作中非常有用——出了问题能快速定位是谁的代码。

### 6. Rust 2024 Edition 的 Borrow Checker 新规则

集成阶段遇到了一个典型问题：agent 生成的代码使用了 `ref mut` 模式匹配：

```rust
// ❌ Rust 2024 不允许
if let Page::Login(ref mut lp) = self.page_stack.last_mut() {
    self.do_login(lp, &phone, &password).await; // borrow checker 报错
}
```

这在 Rust 2021 可以编译，但 Rust 2024 引入了新的隐式借用规则，禁止在隐式借用模式中使用 `ref mut`。修复方式：

```rust
// ✅ 正确写法
if let Page::Login(lp) = self.page_stack.last_mut() {
    // 直接内联逻辑，避免 self 的双重借用
    if let Some(client) = &self.api_client {
        client.login_phone(&phone, &password).await;
    }
}
```

**教训：** agent 对新版 Rust 的规则可能不熟悉，生成的代码可能在旧版能编译但新版不行。`cargo check` 是最好的验证工具。

### 7. 集成阶段的"蝴蝶效应"

app.rs 集成时发现一个连锁反应：给 App 添加 `api_client` 和 `player` 字段后，需要修改几乎所有 TUI 页面的 `PageAction` 定义。

delegate_agent 的处理方式很聪明：
1. 先修改 `pages/mod.rs` 添加新的 `PageAction` 变体
2. 然后逐个修改每个页面的 `handle_event` 返回值
3. 最后修改 `app.rs` 处理新的 action

这体现了 agent 的"全局视野"——它不只是完成指定任务，还会主动修补相关的依赖代码。

### 8. Hermes 的角色定位

Hermes 不应该写代码，而应该：

1. **设计接口** — 定义 trait，让 agent 各自实现
2. **拆分任务** — 把大需求分解成小的、可独立完成的单元
3. **Review 代码** — 检查 `cargo check`、`git diff`、逻辑正确性
4. **集成合并** — 处理冲突，确保整体一致性
5. **记录经验** — 写文档、更新计划

**一句话：Hermes 是架构师 + 项目经理，agent 是执行者。**

## 性能数据

| 任务 | Agent | 耗时 | 结果 |
|------|-------|------|------|
| crypto 加密模块 | Hermes | ~5min | ✅ |
| login_phone | Codex | ~3min | ✅（有语法错误需修复） |
| home + search 页面 | Claude Code | ~2min | ✅ |
| playlist 页面 | Claude Code | ~2min | ✅ |
| player 页面 | Claude Code | ~3min | ✅ |
| search_songs + song_url | delegate_agent | ~120s | ✅ |
| 9 个 API 方法 | delegate_agent | ~146s | ✅ |
| login + settings 页面 | delegate_agent | ~126s | ✅ |
| player + queue 核心 | delegate_agent | ~282s | ✅ |
| warnings 修复 + serde rename | delegate_agent | ~106s | ✅ |
| app.rs 集成 + borrow checker 修复 | delegate_agent | ~164s | ✅ |

**总计：约 25 分钟完成 4300+ 行 Rust 代码，10 个 commit，0 个 todo stub。**

## 踩坑记录

### Codex CLI 超时问题
`codex exec` 在处理大任务时几乎必超时（>240s）。即使拆成单函数级别，也有 50% 的概率超时。最终方案：放弃直接调用 CLI，改用 `delegate_task`。

### Claude Code 的 `--acp` 参数
`claude -p --acp` 会报 `unknown option '--acp'`。正确的非交互模式是 `claude -p --dangerously-skip-permissions`。

### 同文件冲突
当两个 agent 同时修改 `client.rs` 和 `models.rs` 时，后完成的会覆盖先完成的改动。解决方案：串行执行，或让单个 agent 一次处理所有同文件的改动。

### delegate_agent 的意外改动
delegate_agent 会"越权"修改任务范围外的文件。每次任务完成后必须 `git diff --stat` 检查实际改动范围。

## 总结

多 Agent 协同开发的核心不是"让 AI 写所有代码"，而是**建立一套有效的工作流**：

1. **人定方向** — 架构设计、需求分析
2. **Hermes 拆任务** — 接口定义、任务分配
3. **Agent 执行** — 并行开发、独立完成
4. **Hermes 集成** — Review、合并、测试

这套模式在 Rust 项目中特别有效，因为 `cargo check` 提供了即时的编译验证，让 agent 能快速迭代。

> 最终成果：10 个 commit，4327 行 Rust 代码，0 个 todo stub，一个功能完整、可编译的网易云 TUI 播放器。
>
> 关键发现：`delegate_task` 是最稳定的多 Agent 调度方式；Rust 的 `cargo check` 为 AI 编码提供了即时反馈闭环；Hermes 的价值不在于写代码，而在于**设计接口、拆分任务、审查质量**。
