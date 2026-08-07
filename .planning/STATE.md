---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: v1.0 正式版
status: complete
last_updated: 2026-08-07T00:00:00.000Z
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 10
  completed_plans: 10
  percent: 100
---

# Project State: Obsidian Narrative Toolchain

**Last Updated:** 2026-08-07
**Milestone:** v1.0 — ✅ SHIPPED (Phase 5-9 all complete)

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-06)

**Core Value:** 策划在 Obsidian 中完成 Flow → Dialogue 的全链路编辑，并一键导出为 Godot 可读取的 `.dialogue` 文件。

**Current Focus:** v1.0 已交付。等待下一里程碑需求（v1.1+ 候选：节点级 tags 导出、MutationObserver 替换轮询等）

## Current Position

| Attribute | Value |
|-----------|-------|
| Milestone | v1.0 正式版 — ✅ SHIPPED 2026-08-07（Phase 5-9, 10 plans） |
| v0.1 MVP | SHIPPED 2026-08-06（Phase 1-4, 12 plans） |
| Phase 5 | Plugin Merge + Bug Fixes — 5/5 plans complete, UAT passed 2026-08-07 |
| Phase 6 | Engine Features — 2/2 plans complete, UAT passed 2026-08-07 |
| Phase 7 | Build + Deployment — 1/1 plan complete（npm run build → output/narrative-tool/） |
| Phase 8 | UX — 1/1 plan complete（中文化+浏览按钮+进度反馈）, UAT passed 2026-08-07 |
| Phase 9 | Verification — Phase 1-4 各补 VERIFICATION.md + VALIDATION.md，EXP-06 重新界定关闭 |
| Tests | 310/310 passing |
| Next | 下一里程碑需求收集 |

## Performance Metrics

| Metric | Target | v0.1 Result |
|--------|--------|-------------|
| Build time (esbuild, per plugin) | < 2s | ~200ms |
| Test suite runtime | < 5s | ~125ms (203+ tests) |
| Plugin file size (per main.js) | < 500KB | ~10-30KB |

## Accumulated Context

### Key Decisions

- Four-phase roadmap: Foundation -> Export -> Entities+Flow -> Project
- New plugins follow Minimal Plugin Wrapper pattern
- Export engine is pure data transformation (testable without Obsidian)
- Flow Tools augment native Canvas, do not replace it
- File-based inter-plugin communication
- Pure JavaScript, esbuild bundling, node:test for validation
- Canvas node ID: 16-char hex lowercase via crypto.randomBytes
- DEFAULT_SETTINGS is Object.freeze()
- Auto-export 2-second debounce with Set-based dedup
- Reference validator only checks Flow→Dialogue direction
- Status bar success/failure auto-revert to pending after 5 seconds
- 2026-08-07 用户决策：D2 Choice 循环 = 画环到 Choice 节点；D3 汇合命名 = 混合（优先已有 Marker）
- 2026-08-07 UAT 全部通过（A8 迁移验证用户主动跳过）
- 2026-08-07 Flow 创建重构为 articy 风格：只需名称；Flow 自带同名 Fragment 文件夹；Fragment 必须挂父 Flow 并回写引用节点；canvas-templates 模板模块整体下线（含 12 个 golden 测试）
- 2026-08-07 Phase 8：D5 实测 remote-ok → UX-01 用 electron.remote.dialog 文件夹选择器；UX-02 全面中文化（命令 ID 不变，esbuild 产物中文为 \uXXXX 转义，属正常）；UX-03 batch-export 增加 onProgress 回调 + errors 明细
- 2026-08-07 Phase 9：EXP-06（节点 tags 导出）验证发现从未实现，用户决策重新界定为"正文内联 [#...] 透传"并关闭；节点级 tags 导出留作 v1.1+ 候选

### Known Gaps (deferred to v0.2)

- ENT-03: Quest entity template — ✅ FIXED in Phase 5 (createQuestMd restored)
- B1/B2: batch-export and auto-export ignore Export Path — ✅ FIXED in Phase 5 (paths.js writeDialogueFile)
- B3: Canvas template functions unwired — ✅ FIXED in Phase 5 (commands wired)
- FLW-05: Reverse navigation (openFlowCanvas) — ✅ FIXED in Phase 5 (command + file menu)
- All 4 phases lack VERIFICATION.md and VALIDATION.md — ✅ FIXED in Phase 9 (2026-08-07)
- 9 orphaned exports (functions/constants exported but unused in production) — review during Phase 6

### Blockers

- None (milestone complete)
- v0.2 blockers documented in REQUIREMENTS-NEXT.md

---

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-08-06. **Phase 5 (2026-08-06) resolved items marked ✅; remaining items tracked in v1.0 roadmap (Phases 6-9).**

| Category | Item | Status |
|----------|------|--------|
| code-regression | ENT-03 Quest template removed | ✅ fixed (Phase 5) |
| integration | B1 batch-export ignores exportPath | ✅ fixed (Phase 5) |
| integration | B2 auto-export ignores exportPath | ✅ fixed (Phase 5) |
| integration | B3 Canvas templates unwired | ✅ fixed (Phase 5) |
| integration | W1 Quest schema orphaned | ✅ fixed (Phase 5 — schema used by createQuestMd) |
| integration | W2 Reverse navigation unwired | ✅ fixed (Phase 5) |
| verification | All 4 phases lack VERIFICATION.md | ✅ fixed (Phase 9) |
| nyquist | All 4 phases lack VALIDATION.md | ✅ fixed (Phase 9) |
| features | FEAT-01 Choice 循环返回 / FEAT-02 共享去重 | ✅ done (Phase 6, 2026-08-07) — Godot DM 编译验证 pending |
| engineering | ENG-02 output/ 部署目录 / ENG-03 构建脚本 | Phase 7 |
| ux | UX-01 浏览按钮 / UX-02 中文化 / UX-03 反馈优化 | ✅ done (Phase 8, 2026-08-07) — 待人工 UAT |
| uat | Phase 5 人工 UAT（8 项，见 05-VERIFICATION.md） | pending human verification |

---
*State initialized: 2026-07-23*
*Last updated: 2026-08-06 — v0.1 milestone archived*
