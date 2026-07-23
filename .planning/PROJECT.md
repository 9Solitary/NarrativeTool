# Obsidian Narrative Toolchain

## What This Is

一套 Obsidian 插件工具链，使剧情策划能在 Obsidian 内完成从世界观组织、剧情流程设计到对话编辑、导出至 Godot 的完整叙事设计流程。最终目标不是维护一个修改版 Narrative Canvas，而是建立完整的 Obsidian Narrative Workflow，接近 Articy:draft 的叙事设计能力。

目标用户：使用 Godot + Dialogue Manager 的游戏剧情策划。

## Core Value

策划在 Obsidian 中完成 Flow（流程）→ Dialogue（对话）的全链路编辑，并一键导出为 Godot 可读取的 `.dialogue` 文件。

## Requirements

### Validated

<!-- 已有 Narrative Canvas 提供的能力，已实现并验证 -->

- ✓ Dialogue 节点编辑（`.ncanvas`） — Narrative Canvas
- ✓ Dialogue Fragment 编辑（单句/选项节点） — Narrative Canvas
- ✓ Dialogue Branch 分支编辑 — Narrative Canvas
- ✓ 节点连接与属性编辑 — Narrative Canvas
- ✓ Character 管理（名称、定位、语气、备注、发言场景） — Narrative Canvas
- ✓ Character 导出为 Markdown / JSON — Narrative Canvas
- ✓ `.canvas` 可拖入 `.ncanvas` 作为节点引用 — Obsidian 原生能力
- ✓ Obsidian Plugin 运行环境 — Narrative Canvas

### Active

<!-- 当前版本要构建的能力 -->

- [ ] Flow 编辑与导航 — 用 `.canvas` 管理章节/任务/世界事件流程
- [ ] Flow Fragment 局部流程 — 大型流程的细化子图
- [ ] Flow ↔ Dialogue 双向跳转 — 从 Flow 节点打开 Dialogue，从 Dialogue 引用跳回 Flow
- [ ] Dialogue 导出为 `.dialogue` — 兼容 Godot Dialogue Manager 基础语法
- [ ] MED 状态系统导出 — `using S`、`do set_flag`、`[#check]`、`[term]` 等扩展语法
- [ ] 批量导出 — 一次导出多个 `.ncanvas` 为 `.dialogue`
- [ ] 自动导出 — 文件变更时自动触发导出
- [ ] 项目配置 — 导出路径、格式选项、插件间协调
- [ ] Graph View 增强 — Flow/Dialogue/Character/Quest/Location/Item 被 Graph 正确索引

### Out of Scope

- 重新实现 Dialogue 编辑器 — Narrative Canvas 已承担，本项目不重复造轮子
- 修改 Narrative Canvas 核心编辑逻辑 — 尽量少改，通过新插件扩展
- 数据库或专有格式存储 — 所有数据保存在普通文件中
- 非 Godot 引擎的导出目标 — 当前仅支持 Godot Dialogue Manager
- 移动端 Obsidian — 仅桌面端

## Context

### 现有代码基础

- **Narrative Canvas**（`NarrativeCanvas/`）：已有 Obsidian 插件，提供可视化 Dialogue 编辑器。架构为双层结构 —— 薄插件包装层（`main.js`）包裹无框架 Canvas 应用（`app.js`），通过 `NarrativeCanvasHost` 桥接模式分离 Vault I/O 与编辑器逻辑。纯 JavaScript，无 TypeScript。
- **TestVault**（`TestVault/`）：Obsidian 测试 Vault，用于验证插件行为。
- **代码库映射**：已生成 7 份代码库文档在 `.planning/codebase/`，包含架构、技术栈、测试、关注点等信息。

### 目标格式

- **Godot Dialogue Manager**：基础语法（`Character: text`、`- 选项`、`~ cue`、`=> jump`、`[if condition]`、`[#tags]`）
- **MED 状态扩展**：`using S` 状态系统、`do set_flag`/`do add_res` 等修改语句、`[#check=type:id:threshold]` 检定语法、`[term=id]` 说明词、`{{res(&"id")}}` 等内联状态显示、`~ direct_check` 直接检定

### 实体类型

| 实体 | 文件格式 | 说明 |
|------|----------|------|
| Flow | `.canvas` | 章节/任务/世界事件级别，Obsidian 原生 Canvas |
| Flow Fragment | `.canvas` | 局部流程细化，同上格式 |
| Dialogue | `.ncanvas` | 完整一次对话，Narrative Canvas 编辑 |
| Dialogue Fragment | 节点 | Narrative Canvas 内单句/选项节点 |
| Character | `.md` | 名称、定位(Role)、语气(Voice)、备注、发言场景 |
| Location | `.md` | 待设计 |
| Quest | `.md` | 待设计 |
| Item | `.md` | 待设计 |

### 设计原则

1. 尽可能复用 Obsidian 原生能力
2. 尽可能减少对 Narrative Canvas 核心编辑器的修改
3. 将导出逻辑与编辑逻辑解耦
4. 插件职责单一，避免形成大型单体插件
5. 所有数据保存在普通文件中，避免数据库或专有格式
6. 保持与 Obsidian 社区生态兼容

## Constraints

- **技术栈**: JavaScript（无 TypeScript），与 Narrative Canvas 保持一致；Obsidian Plugin API
- **兼容性**: 导出格式需兼容 Godot Dialogue Manager + MED 项目的状态扩展
- **架构**: 新插件遵循 NarrativeCanvasHost 桥接模式，不破坏现有 Narrative Canvas 功能
- **文件格式**: Flow 层使用 Obsidian 原生 `.canvas` JSON；Dialogue 层使用 `.ncanvas`；实体使用 `.md`
- **打包**: 各插件独立，通过 shared 模块共享类型和工具

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Flow 层使用原生 Canvas 而非自定义编辑器 | 完全兼容 Obsidian，无需维护额外编辑器，Graph 天然支持 | — Pending |
| Flow Fragment 也用 `.canvas` 而非扩展 `.fncanvas` | 维护成本低，复用同一套能力 | — Pending |
| 导出目标为 Godot Dialogue Manager + MED 扩展 | 用户项目已基于此技术栈 | — Pending |
| 插件拆分：Flow Tools / Dialogue Export / Narrative Project | 职责单一，可独立开发测试，避免大型单体插件 | — Pending |
| 角色/地点/道具等实体使用 Markdown | 兼容 Obsidian 生态，Graph 天然可索引 | — Pending |
| 不修改 Narrative Canvas 核心编辑逻辑 | 降低维护负担，避免 fork 升级冲突 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-23 after initialization*
