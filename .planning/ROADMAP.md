# Roadmap: Obsidian Narrative Toolchain

**Created:** 2026-07-23
**Granularity:** Standard
**Phases:** 9 (4 shipped + 5 planned for v1.0)

## Milestones

- ✅ **v0.1 MVP** — Phases 1-4 (shipped 2026-08-06)
- 🚧 **v1.0 正式版** — Phases 5-9 (in progress)

## Phases

<details>
<summary>✅ v0.1 MVP (Phases 1-4) — SHIPPED 2026-08-06</summary>

- [x] **Phase 1: Project Foundation** (3/3 plans) — completed 2026-07-24
- [x] **Phase 2: Dialogue Export** (3/3 plans) — completed 2026-07-24
- [x] **Phase 3: Entities + Flow Tools** (3/3 plans) — completed 2026-07-24
- [x] **Phase 4: Narrative Project** (3/3 plans) — completed 2026-07-24

</details>

## 🚧 v1.0 正式版 (In Progress)

**Milestone Goal:** 修复 v0.1 所有已知差距 + 实现用户反馈的核心功能（Choice 循环、共享去重）+ 工程化打磨（插件合并、一键构建、中文化），交付完整、稳定、可部署的正式版。

- [ ] **Phase 5: Plugin Merge + Bug Fixes** — 三插件合并为 narrative-tool，v0.1 的 7 项已知缺陷全部修复
- [ ] **Phase 6: Engine Features** — Choice 循环返回 + 共享内容去重，导出引擎两遍式改造
- [ ] **Phase 7: Build + Deployment** — npm run build 一键构建，output/ 部署产物目录
- [ ] **Phase 8: UX** — 全面中文化、Export Path 浏览按钮、导出状态反馈优化
- [ ] **Phase 9: Verification** — Phase 1-4 全部补 VERIFICATION.md + Nyquist 验证

## Phase Details

### Phase 5: Plugin Merge + Bug Fixes
**Goal**: v0.1 的三个插件合并为单一 narrative-tool 插件，7 项已知缺陷全部修复；用户升级后无功能丢失、无配置丢失
**Depends on**: Phase 4 (v0.1, shipped)
**Requirements**: ENG-01, BUG-01, BUG-02, BUG-03, BUG-04, BUG-05, BUG-06, BUG-07
**Success Criteria** (what must be TRUE):
  1. User installs the single narrative-tool plugin and every command from the three v0.1 plugins (Flow Canvas 创建、Quest 创建、对话导出、批量导出、自动导出等) still appears, with all command IDs unified to the new narrative-tool: prefix (D-08 — D-09 documents the intentional break to existing hotkey bindings); existing settings keys and values migrate to the merged plugin automatically
  2. User can create a Quest entity via command palette and the file menu now includes "Add quest node" alongside the other 3 entity node types; the Quest .md template opens with correct content
  3. User can create Flow Canvas / Flow Fragment via commands and gets the proper Canvas templates; from a Dialogue canvas, user can navigate back to its Flow canvas via command and right-click menu
  4. User sets Export Path in settings once; both batch export and auto export write `.dialogue` files into that configured path
  5. Entity .md nodes on the canvas are visually distinguished from plain text nodes via CSS data-nt-type
**Plans**: 5 plans

Plans:
- [ ] 05-01-PLAN.md — Engine layer: git mv export engine + shared constants into engine/ (D-03), re-point engine tests, purity guard
- [ ] 05-02-PLAN.md — Flow layer: git mv flow modules + schema into engine/schema, BUG-01 restore createQuestMd + golden + tests
- [ ] 05-03-PLAN.md — Commands/UI layer: shared paths module fixes BUG-02/03, export-current dedup, modals/notify/nc-bridge, settings+status-bar renames
- [ ] 05-04-PLAN.md — Plugin identity + merged main.js: 10 narrative-tool: commands, D-06 migration, BUG-04/05/06/07 wiring, merge-smoke + navigation tests
- [ ] 05-05-PLAN.md — Delete legacy plugins, esbuild build, full suite + golden byte-identical verification
**UI hint**: yes

### Phase 6: Engine Features
**Goal**: 导出引擎支持 Choice 循环返回与共享内容去重，导出的 .dialogue 在 Godot DM 中可编译运行
**Depends on**: Phase 5
**Requirements**: FEAT-01, FEAT-02
**Success Criteria** (what must be TRUE):
  1. When the user draws a loop from a Choice option back to an earlier Choice node, export no longer crashes (no stack overflow); the exported .dialogue compiles in Godot DM and the player can return to the Choice and re-pick an option (`~ cue` + `=> cue` syntax)
  2. "说明" type options loop back to the Choice for re-selection, while "答应" type options continue the dialogue forward
  3. When multiple choice branches converge on the same dialogue segment, the shared content appears exactly once in the exported file, with each branch jumping to the merge point via `=> merge_cue`
  4. Ambiguous convergence cases never produce wrong joins: content is duplicated with a warning instead
  5. All 9 existing golden files remain byte-identical (regression contract: pre-pass returns empty for acyclic graphs)
**Plans**: TBD

### Phase 7: Build + Deployment
**Goal**: 一键构建脚本 + 标准部署产物目录，任何 vault 可直接部署
**Depends on**: Phase 6
**Requirements**: ENG-02, ENG-03
**Success Criteria** (what must be TRUE):
  1. User runs `npm run build` from repo root; esbuild compiles the entire merged plugin in a single step with no errors
  2. After build, `output/narrative-tool/` contains `main.js` + `manifest.json` + `styles.css`, ready to copy into any Obsidian vault
  3. User copies the output directory into a fresh vault, enables the plugin, and all commands and settings work without errors
  4. Test suite (203+ tests) still passes after the build pipeline change
**Plans**: TBD

### Phase 8: UX
**Goal**: 全中文界面 + 顺手的导出路径选择 + 清晰的导出反馈
**Depends on**: Phase 7
**Requirements**: UX-01, UX-02, UX-03
**Success Criteria** (what must be TRUE):
  1. In settings, the Export Path field has a "浏览" button that opens a folder picker (Electron dialog, shell fallback if unavailable) and fills the chosen path into the field
  2. All command names, context menus, status bar messages, settings labels, and notifications are in Chinese; command IDs unchanged so existing hotkeys and links keep working
  3. Batch export shows progress (x/n) in the status bar as it processes files
  4. When export fails, the status bar or notification shows the specific error message (e.g. missing directory, invalid syntax) instead of a generic failure
**Plans**: TBD
**UI hint**: yes

### Phase 9: Verification
**Goal**: Phase 1-4 全部具备正式验证证据，v1.0 可审计交付
**Depends on**: Phase 8
**Requirements**: VERIF-01, VERIF-02
**Success Criteria** (what must be TRUE):
  1. Each of the 4 v0.1 phases has a VERIFICATION.md documenting which success criteria were verified and how
  2. Each of the 4 v0.1 phases has a Nyquist VALIDATION.md with test evidence covering every behavior claim
  3. A reviewer can trace every v0.1 success criterion to a concrete test or artifact without reading implementation code
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Project Foundation | v0.1 | 3/3 | Complete | 2026-07-24 |
| 2. Dialogue Export | v0.1 | 3/3 | Complete | 2026-07-24 |
| 3. Entities + Flow Tools | v0.1 | 3/3 | Complete | 2026-07-24 |
| 4. Narrative Project | v0.1 | 3/3 | Complete | 2026-07-24 |
| 5. Plugin Merge + Bug Fixes | v1.0 | 0/5 | Not started | - |
| 6. Engine Features | v1.0 | 0/0 | Not started | - |
| 7. Build + Deployment | v1.0 | 0/0 | Not started | - |
| 8. UX | v1.0 | 0/0 | Not started | - |
| 9. Verification | v1.0 | 0/0 | Not started | - |

---
*Roadmap created: 2026-07-23*
*Last updated: 2026-08-06 — v1.0 roadmap created (Phases 5-9)*
