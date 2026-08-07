# HANDOVER — Obsidian Narrative Toolchain

**交接日期:** 2026-08-07
**仓库:** `C:\CodingProject\NarrativeTool`（git, main 分支）
**上一阶段状态:** v0.1 MVP 已交付；v1.0 里程碑进行中（Phase 5 已完成，Phase 6-9 未开始）
**交接人:** Claude（上一会话） → **接收人:** 下一会话/协作者

---

## 1. 项目是什么

一套面向叙事策划的 Obsidian 插件工具链：在 Obsidian 内完成 **Flow（流程，`.canvas`）→ Dialogue（对话，`.ncanvas`）** 的全链路编辑，并一键导出为 Godot Dialogue Manager 可读取的 `.dialogue` 文件（含 MED 状态扩展）。

- **技术栈:** 纯 JavaScript + Obsidian Plugin API + esbuild + `node:test`
- **目标用户:** 使用 Godot + Dialogue Manager 的游戏剧情策划
- **设计原则:** Flow 层复用原生 Canvas、导出引擎纯数据转换（可脱离 Obsidian 测试）、纯文件存储、渐进增强（不修改 Narrative Canvas 核心）

---

## 2. 当前进度总览

| 里程碑 | 阶段 | 计划 | 状态 |
|--------|------|------|------|
| v0.1 MVP（已交付 2026-08-06） | 1. Project Foundation | 3/3 | ✅ |
| | 2. Dialogue Export | 3/3 | ✅ |
| | 3. Entities + Flow Tools | 3/3 | ✅ |
| | 4. Narrative Project | 3/3 | ✅ |
| v1.0（进行中） | 5. Plugin Merge + Bug Fixes | 5/5 | ✅ 2026-08-06 |
| | 6. Engine Features | 0 | ⏳ 未开始 |
| | 7. Build + Deployment | 0 | ⏳ 未开始 |
| | 8. UX | 0 | ⏳ 未开始 |
| | 9. Verification | 0 | ⏳ 未开始 |

**关键数字（Phase 5 结束时）:**
- 测试: **266/266 通过**（`node --test tests/`，约 125ms 运行时长）
- 合并后插件: 单一 `narrative-tool` 插件，**10 个命令**，构建产物 `main.js` 约 48KB
- 9 个 golden 导出文件保持字节一致（导出回归契约）

---

## 3. 最近完成的工作（Phase 5: Plugin Merge + Bug Fixes）

将 v0.1 的三个插件（`dialogue-export` / `flow-tools` / `narrative-project`）合并为单一 **`narrative-tool`** 插件（ENG-01），并修复 7 项已知缺陷（BUG-01..07）：

| 修复项 | 内容 | 验证方式 |
|--------|------|----------|
| BUG-01 | 恢复 Quest 实体模板（`createQuestMd` + golden 测试 + "Add quest node" 菜单项） | ✅ 单测 |
| BUG-02 | 批量导出写入配置的 Export Path（此前写入 vault 根目录） | ✅ 单测 |
| BUG-03 | 自动导出写入配置的 Export Path（此前写入源文件旁） | ✅ 单测 |
| BUG-04 | Canvas 模板函数（`createFlowCanvas`/`createFlowFragment`）接入命令 | ✅ 单测 |
| BUG-05 | 反向导航（`openFlowCanvas`/`findFlowCanvasForDialogue`）接入命令 + 右键菜单 | ✅ 单测 |
| BUG-06 | Entity `.md` 节点 `data-nt-type` CSS 视觉区分，运行时注入 | ✅ 单测 |
| BUG-07 | 设置项自动迁移（读取旧插件 `data.json`，仅首次加载） | ✅ 单测 |

**合并后插件结构**（`plugins/narrative-tool/src/`）:
```
main.js           ← 10 个 narrative-tool: 前缀命令 + 文件菜单 + 设置迁移
engine/           ← 纯数据转换（零 obsidian 依赖，有 purity 测试守护）
  ├── export-engine.js / gd-format.js / med-format.js
  └── schema/（character / location / quest / item）+ gd-constants.js
commands/         ← export-current / batch-export / auto-export / reference-validator
flow/             ← canvas-templates / navigation / entity-templates
ui/               ← settings / status-bar / modals / notify / nc-bridge
```

**架构决策（已完成）:**
- 三插件合并 → 单一 `narrative-tool`（REQUIREMENTS-NEXT.md 中 D1 已按方案 A 落地）
- 命令 ID 统一为 `narrative-tool:` 前缀（旧的 `dialogue-export:` 等热键绑定会断开，属预期破坏，记录在 `05-CONTEXT.md` D-08/D-09）
- 引擎与常量迁入 `engine/`，`engine-purity.test.js` 递归守护"引擎零 obsidian 依赖"
- 导出引擎保持纯函数，9 个 golden 文件回归契约生效

---

## 4. ⚠️ 待办：Phase 5 人工 UAT（8 项，需真实 Obsidian 环境）

代码层面 7/7 验证通过（见 `05-VERIFICATION.md`），但以下行为只在真实 Obsidian 运行时可见，**尚未有人工确认**：

1. 安装 `narrative-tool` 到真实 vault，插件无错误加载，10 个命令全部出现
2. "Create Quest" 命令端到端创建 Quest .md（modal → 文件 → 自动打开）
3. `.canvas` 文件右键菜单含全部 6 项（dialogue/character/location/item/quest 节点 + Open linked dialogue）
4. "Create Flow Canvas / Fragment" 模板化创建并打开
5. `.ncanvas` 反向导航到所属 Flow canvas（命令 + 右键菜单）
6. Export Path（相对 + 绝对）在批量导出与自动导出中真正生效
7. 对话节点蓝色边框、实体节点青色边框（`data-nt-type`）在 Canvas 中可见
8. 旧插件 `data.json` → `narrative-tool` 设置自动迁移场景

---

## 5. 已知差距与技术债（进入 Phase 6 前请知悉）

### 5.1 v0.1 审计遗留（REQUIREMENTS-NEXT.md §6）

- **ENT-03** Quest 模板 — ✅ 已在 Phase 5 修复（createQuestMd 恢复）
- **B1/B2** exportPath 被忽略 — ✅ 已在 Phase 5 修复（paths.js `writeDialogueFile` 三分支）
- **B3** Canvas 模板函数未接入 — ✅ 已在 Phase 5 修复
- **W2** 反向导航未接入 — ✅ 已在 Phase 5 修复（FLW-05）

### 5.2 仍存在

- **9 个孤立导出**（顶层导出但生产无消费者）: `topologicalSort`、`resolveCharacter`、`QuestTemplate` 等 — Phase 5 未清理（保留供测试/后续使用），Phase 6 改造导出引擎时可顺手处理
- **Phase 1-4 全部缺少 VERIFICATION.md 和 VALIDATION.md** → 归入 Phase 9
- **E2E 流程状态:** F3（Quest 创建）✅ 已修复；F5（Dialogue→Flow 返回）✅ 已修复；F7（模板 Flow Canvas）✅ 已修复 — 全部待人工 UAT 复核

### 5.3 文件/工作区卫生（重要）

| 项目 | 说明 | 建议 |
|------|------|------|
| `.planning/STATE.md` | **有未提交修改**（milestone_complete 化），且 milestone 字段仍为 v0.1 — 与 ROADMAP 已进入 v1.0 不一致 | 推进 v1.0 里程碑时更新并提交 |
| `README.md`、`Basic_Dialogue.md`、`Characters.md`、`ObsidianNarrativeToolchain.md` | 未跟踪（v0.1 后新增的说明/样例文档） | 确认是否纳入版本控制 |
| `NarrativeCanvas/`（33MB） | Narrative Canvas 第三方插件源码（`nicolering/NarrativeCanvas`），用于本地开发/参考 | 确认是否加入 `.gitignore` |
| `TestVault/`（36MB） | 手动测试用 Obsidian vault | 确认是否加入 `.gitignore` |
| `tests/temp/` | 临时测试文件（esb-test、test-real-data.js） | 可清理 |
| 旧插件目录 `plugins/{dialogue-export,flow-tools,narrative-project}/` | 仅剩 gitignored 的 main.js/node_modules 残留 | 可物理删除 |

---

## 6. 接下来做什么（v1.0 路线图，来自 ROADMAP.md）

### Phase 6: Engine Features（下一阶段）
**需求:** FEAT-01（Choice 循环返回）+ FEAT-02（共享内容去重）
**目标:** 导出引擎支持环检测与路径汇合，导出 .dialogue 在 Godot DM 中可编译运行
**要点:**
- 用户画一条回到 Choice 节点的连线 → 导出 `~ cue` + `=> cue` 跳转语法（"说明"类选项循环，"答应"类继续推进）
- 多个 Choice 分支汇合到同一段对话 → 共享内容只出现一次，各分支 `=> merge_cue` 跳转
- 歧义汇合宁可重复内容 + 警告，不产生错误连接
- **回归契约: 9 个现有 golden 文件保持字节一致**（无环图时预遍历返回空）
- 仅改动导出引擎（`engine/export-engine.js` + `engine/gd-format.js`），不涉及 Narrative Canvas

### Phase 7: Build + Deployment
- 根目录 `npm run build` 一键构建（esbuild 单步）
- `output/narrative-tool/` 部署产物（main.js + manifest.json + styles.css），直接复制进任意 vault

### Phase 8: UX
- 全部命令/右键菜单/状态栏/设置项中文化（命令 ID 不变）
- Export Path 设置加"浏览"按钮（Electron dialog + shell 兜底）
- 批量导出进度显示（x/n）、失败时具体错误信息

### Phase 9: Verification
- Phase 1-4 补 VERIFICATION.md（成功标准可追溯）
- Phase 1-4 补 Nyquist VALIDATION.md（行为声明 → 测试证据）

---

## 7. 待确认的架构决策（Phase 6 规划时需讨论）

| # | 决策点 | 选项 |
|---|--------|------|
| D2 | Choice 循环返回：Canvas 上如何表达"返回 Choice"的意图？ | A: 画环到 Choice 节点 / B: 画到 Choice 前 Marker / C: 节点属性设 goto |
| D3 | 共享去重：汇合点 Marker 由谁命名？ | A: 用户手动放 Marker / B: 引擎自动生成（`~ merge_01`）/ C: 混合（优先已有 Marker） |
| D4 | 部署目录名 | 倾向 `output/` |
| D5 | Electron dialog API 在目标 Obsidian 版本是否可用 | 需实测（Phase 8 前验证） |
| 优先级 | 用户建议 P0 = 中文化/构建脚本/output 目录；P1 = 浏览按钮/Choice 循环/共享去重 | Phase 6-8 顺序已按此排 |

---

## 8. 常用命令速查

```bash
# 运行全部测试（266 个）
node --test tests/

# 构建合并插件（需先在 plugins/narrative-tool/ 下 npm install）
cd plugins/narrative-tool && node esbuild.config.mjs

# 查看 GSD 状态
# .planning/STATE.md  /  .planning/ROADMAP.md  /  .planning/REQUIREMENTS-NEXT.md
```

---

## 9. 建议的第一步

1. **推进里程碑**: 运行 `/gsd:new-milestone`（或按 GSD 流程更新 `.planning/STATE.md` 到 v1.0，提交工作区改动）
2. **人工 UAT**: 把 `plugins/narrative-tool/` 构建产物装入真实 vault，完成 §4 的 8 项人工验证（Phase 5 收尾）
3. **规划 Phase 6**: 先用 discuss-phase 确认 D2/D3 决策，再进入 plan-phase

---
*Handover 生成: 2026-08-07 | 信息来源: .planning/STATE.md、ROADMAP.md、PROJECT.md、REQUIREMENTS-NEXT.md、05-VERIFICATION.md、git log*
