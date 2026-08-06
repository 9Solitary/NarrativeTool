# Obsidian Narrative Toolchain

## What This Is

一套 Obsidian 插件工具链，使剧情策划能在 Obsidian 内完成从世界观组织、剧情流程设计（Flow Canvas）到对话编辑（Narrative Canvas）、导出至 Godot Dialogue Manager 的完整叙事设计流程。v0.1 已实现核心工作流：创建实体 → 组织 Flow → 编辑对话 → 导出 .dialogue。

目标用户：使用 Godot + Dialogue Manager 的游戏剧情策划。

## Core Value

策划在 Obsidian 中完成 Flow（流程）→ Dialogue（对话）的全链路编辑，并一键导出为 Godot 可读取的 `.dialogue` 文件。

## Requirements

### Validated

<!-- v0.1 shipped requirements -->

- ✓ 项目工作区结构 + shared 模块 — v0.1
- ✓ Godot DM + MED token 常量 — v0.1
- ✓ 实体类型 schemas (Character/Location/Quest/Item) — v0.1
- ✓ esbuild 构建系统 — v0.1
- ✓ node:test 测试基础设施 — v0.1 (203+ tests)
- ✓ .ncanvas → .dialogue 导出 (Godot DM 基础语法) — v0.1
- ✓ MED 状态系统导出 (using S, set_flag, add_res, checks, terms, inline state) — v0.1
- ✓ BBCode 透传 — v0.1
- ✓ Character/Location/Item Markdown 模板 — v0.1
- ✓ Flow Canvas + Flow Fragment .canvas 模板 — v0.1
- ✓ Flow → Dialogue 导航 (file-menu) — v0.1
- ✓ 项目配置 UI (Export Path, MED toggle, Export Scope) — v0.1
- ✓ 批量导出命令 — v0.1
- ✓ 自动导出 (debounced file watcher) — v0.1
- ✓ 导出状态指示 (StatusBarManager) — v0.1
- ✓ Flow→Dialogue 引用验证 — v0.1

### Active

<!-- v0.2 planned -->

- [ ] 恢复 Quest 实体模板 (ENT-03) — createQuestMd 回归
- [ ] 修复 exportPath 在 batch/auto export 中被忽略 (B1, B2)
- [ ] 接入 Canvas 模板函数 (FLW-01, FLW-02)
- [ ] 接入反向导航 openFlowCanvas (FLW-05)
- [ ] 添加 "Add quest node" 至 file-menu (FLW-06)
- [ ] Entity .md 节点 data-nt-type CSS 激活 (FLW-03)
- [ ] 运行 Nyquist 验证覆盖所有阶段
- [ ] Choice 循环返回 (FEAT-01)
- [ ] 共享内容去重 — 路径汇合优化 (FEAT-02)
- [ ] 插件合并 (ENG-01)
- [ ] 部署产物目录 output/ (ENG-02)
- [ ] 构建脚本自动化 (ENG-03)
- [ ] 导出路径 "浏览" 按钮 (UX-01)
- [ ] 右键菜单与命令中文化 (UX-02)

### Out of Scope

- 自定义 Flow 编辑器（替代 Obsidian Canvas） — 复用原生能力
- Dialogue 编辑器重写 — Narrative Canvas 已承担
- Narrative Canvas 核心编辑逻辑修改 — 尽量少改
- 数据库或专有格式存储 — 所有数据保存在普通文件中
- 非 Godot 引擎导出目标 — 仅 Godot Dialogue Manager
- TypeScript 迁移 — JS 代码库互操作成本过高
- 移动端 Obsidian 支持 — 仅桌面端
- 游戏内运行时预览 — 不属于叙事设计工具
- 实时多人协作编辑 — Obsidian 文件级协作 (Git) 已可用
- OAuth / 用户系统 — 本地插件

## Context

### 当前代码库状态

- **v0.1 已交付** — 2026-08-06
- **代码规模**: ~2,600 LOC 插件源码, ~3,600 LOC 测试, ~280 LOC shared 模块
- **测试**: 203+ tests, 0 failures
- **技术栈**: JavaScript, Obsidian Plugin API, esbuild, node:test
- **3 个插件**: dialogue-export, flow-tools, narrative-project
- **12 个计划完成**, 4 个阶段交付

### v0.1 已知差距

v0.1 里程碑审计发现 4 个 BLOCKER 和 5 个 WARNING 级别问题，包括 Quest 模板代码被删除、batch/auto export 忽略 Export Path 设置、Canvas 模板函数未接入等。详见 `.planning/REQUIREMENTS-NEXT.md §6`。

### 实体类型

| 实体 | 文件格式 | v0.1 状态 |
|------|----------|----------|
| Flow | `.canvas` | ✅ 完整 |
| Flow Fragment | `.canvas` | ⚠️ 简化版 |
| Dialogue | `.ncanvas` | ✅ 完整 |
| Dialogue Fragment | 节点 | ✅ (NC 原生) |
| Character | `.md` | ✅ 模板可用 |
| Location | `.md` | ✅ 模板可用 |
| Quest | `.md` | ❌ 代码已删除 |
| Item | `.md` | ✅ 模板可用 |

## Constraints

- **技术栈**: JavaScript（无 TypeScript）；Obsidian Plugin API
- **兼容性**: 导出格式需兼容 Godot Dialogue Manager + MED 项目状态扩展
- **架构**: 新插件遵循 NarrativeCanvasHost 桥接模式
- **文件格式**: Flow 层用 `.canvas` JSON；Dialogue 层用 `.ncanvas`；实体用 `.md`
- **打包**: 各插件独立，通过 shared 模块共享

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Flow 层使用原生 Canvas 而非自定义编辑器 | 完全兼容 Obsidian，无需维护额外编辑器 | ✅ 已验证 — works as intended |
| Flow Fragment 也用 `.canvas` | 维护成本低，复用同一套能力 | ✅ 已验证 |
| 导出目标为 Godot Dialogue Manager + MED 扩展 | 用户项目已基于此技术栈 | ✅ 已验证 |
| 插件拆分：3 个独立插件 | 职责单一，可独立开发测试 | ⚠️ Revisit — 边界模糊，考虑合并为 1 个 (ENG-01) |
| 实体使用 Markdown | 兼容 Obsidian 生态，Graph 天然可索引 | ✅ 已验证 |
| 不修改 Narrative Canvas 核心编辑逻辑 | 降低维护负担 | ✅ 已验证 |
| 纯 JS + esbuild | 与 NC 代码库一致 | ✅ 已验证 |
| File-based inter-plugin communication | 简单可靠 | ⚠️ Revisit — narrative-project 内联打包了 export engine，导致重复 |
| Export engine 是纯数据转换 | 可在 Obsidian 外测试 | ✅ 已验证 (203+ tests) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**v0.1 milestone completed (2026-08-06):**
- 12/12 计划完成，35/35 v1 需求实现
- 发现 4 BLOCKER + 5 WARNING 差距，推迟至 v0.2
- 插件合并讨论 (ENG-01) 将在 v0.2 规划中评估

---
*Last updated: 2026-08-06 after v0.1 milestone*
