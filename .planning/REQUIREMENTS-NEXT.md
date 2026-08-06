# Requirements: Next Iteration (2026-08-06)

**来源**: 用户在实际使用 `与掌柜对话.ncanvas` 导出到 Godot 项目过程中的反馈
**状态**: 待 discuss-phase 确认优先级

---

## 目录

1. [已完成 (本次会话修复)](#1-已完成)
2. [功能需求 (Features)](#2-功能需求)
3. [工程改进 (Engineering)](#3-工程改进)
4. [用户体验 (UX)](#4-用户体验)
5. [待确认的架构决策](#5-待确认的架构决策)

---

## 1. 已完成

以下问题已在本次会话中修复，记录以备验证：

### 1.1 对话人名重复 (FIXED ✅)

**现象**: 导出 `.dialogue` 文件中出现 `王裕昌: 王裕昌: "..."` 重复前缀

**根因**: Dialog 节点 body 中已包含预格式化的说话人前缀（用户在 Narrative Canvas 中按 `Speaker: text` 格式编写多轮对话），而 `formatDialogLine()` 无条件再追加一次 `${charName}: `。同时，中文输入法产生的全角冒号 `：` (U+FF1A) 未被检查逻辑覆盖。

**修复文件**:
- `plugins/dialogue-export/src/gd-format.js` — `stripSpeakerPrefix()` + `formatDialogLine()` + `formatDialogNode()`
- `plugins/dialogue-export/src/export-engine.js` — 添加 `knownCharacterNames` Set 防止假阳性

**验证**: 103/103 测试通过。真实数据 `与掌柜对话.ncanvas` 导出 0 重复。

### 1.2 `Strength:` 假阳性 (FIXED ✅)

**现象**: Dialog 节点 body 为 `Strength: {res_strength}.` 时，"Strength" 被误认为说话人前缀，"Guard: " 前缀丢失。

**复现数据**: `tests/fixtures/med-checks.ncanvas` n4 节点

**修复**: `formatDialogNode()` 中提取的 speaker 名必须匹配 `knownCharacterNames` 或节点 `charName` 才被视为真正的前缀。

---

## 2. 功能需求

### 2.1 Choice 循环返回 (FEAT-01)

**场景**: 一段 Choice 有 4 个选项，其中 3 个是"说明"类回复（选完后应回到该 Choice），1 个是"答应"类回复（选完后继续推进剧情）。

**期望导出格式**:
```
~ question
- 说明1
    对话... => question
- 说明2
    对话... => question
- 说明3
    对话... => question
- 答应
    对话... => continue
~ continue
后续剧情...
```

**当前状态**: 不支持。`visited` Set 阻止了环的遍历，导出引擎不会生成 `~ marker` + `=> marker` 跳转语法。

**影响范围**: 仅导出引擎 (`export-engine.js` + `gd-format.js`)，不需要改动 Narrative Canvas。

**关键问题**:
- 如何在 Canvas 上表达"返回 Choice"？用户画一条回到 Choice 节点的连线即可（Canvas 已支持任意方向连线）
- 导出引擎需要检测环 → 生成 `~ marker` cue + `=> marker` 跳转

---

### 2.2 共享内容去重 — 路径汇合优化 (FEAT-02)

**场景**: 两个 Choice 选项各自有独立回复（不同的起始节点），但之后汇合到同一段长对话。当前导出会把共享对话在每个选项下各输出一遍。

**期望导出格式**:
```
~ question
- 选项1
    独特对话A...
    => shared
- 选项2
    独特对话B...
    => shared
~ shared
共享对话内容...
~ continue
后续剧情...
```

**当前状态**: 不支持。`walkSubtree()` 为每个选项独立遍历整条链，各自持有独立的 `walkVisited` Set，不感知路径汇合。

**影响范围**: 仅导出引擎，不需要改动 Narrative Canvas。

**关键问题**:
- 检测算法：比较各选项子树的末尾或全部节点，找到第一个公共节点 → 在那里插入 Marker
- 如果用户在汇合点手动放置了 Marker 节点，优先使用其标题命名 cue
- 如果共享路径中有 Choice 节点，需要嵌套处理

---

## 3. 工程改进

### 3.1 插件合并 (ENG-01)

**问题**: 当前 3 个插件 (`dialogue-export`、`narrative-project`、`flow-tools`)，职责边界模糊：
- `dialogue-export` 提供核心引擎 + 自己的"导出当前对话"命令
- `narrative-project` 内联打包了 `dialogue-export` 的引擎代码（esbuild bundle），导致改引擎需要同时重编译两个插件
- `narrative-project` 也有"导出当前对话"命令 → 与 `dialogue-export` 重复
- 每次部署到其他项目需要复制 3 个文件夹

**建议方案**: 合并为单一 `narrative-tool` 插件
```
narrative-tool/
├── src/
│   ├── main.js
│   ├── settings.js
│   ├── status-bar.js
│   ├── engine/
│   │   ├── export-engine.js
│   │   ├── gd-format.js
│   │   └── med-format.js
│   └── commands/
│       ├── export-current.js
│       ├── batch-export.js
│       ├── auto-export.js
│       └── reference-validator.js
├── main.js       ← 一次编译
└── manifest.json
```

**收益**:
- 一次 `node esbuild.config.mjs` 编译
- 复制 1 个文件夹到其他项目
- 无引擎内联副本问题
- 内部目录分离保持代码清晰，引擎仍可独立 `node --test`

---

### 3.2 部署产物目录 (ENG-02)

**问题**: 当前部署到其他项目时需要从 `plugins/` 目录手动筛选文件，容易漏掉或多带。`src/`、`node_modules/`、`package.json` 等仅构建时需要的文件不应出现在部署目录。

**需求**: 在项目根创建 `output/` 目录，编译后自动将部署所需文件复制到此处。

```
output/
└── narrative-tool/
    ├── main.js         ← esbuild 编译产物
    └── manifest.json   ← 插件清单
```

每次修改后：
```bash
node esbuild.config.mjs          # 编译
cp main.js manifest.json ../output/narrative-tool/   # 自动复制
```

部署到其他项目时：复制 `output/narrative-tool/` → `<vault>/.obsidian/plugins/narrative-tool/`

**补充**: 如果保留 3 插件架构，`output/` 下应有 3 个子目录，每个只含 `main.js` + `manifest.json`。

---

### 3.3 构建脚本自动化 (ENG-03)

**问题**: 目前需要手动进入每个插件目录执行 `node esbuild.config.mjs`，容易漏掉或搞错顺序。

**需求**: 根目录添加 `npm run build` 脚本，一键编译所有插件并复制到 `output/`:

```bash
npm run build
  → plugins/dialogue-export: build
  → plugins/narrative-project: build
  → plugins/flow-tools: build
  → copy main.js + manifest.json → output/
```

---

## 4. 用户体验

### 4.1 导出路径 "浏览" 按钮 (UX-01)

**问题**: Export Path 设置当前只能手动输入绝对路径（如 `D:/Godot/dialogues/`），容易出错。

**方案**: 使用 Electron 原生 `dialog.showOpenDialog({properties: ['openDirectory']})`，在设置项的文本框旁添加"浏览..."按钮，点击打开系统文件夹选择器。

**影响文件**: `plugins/narrative-project/src/settings.js`

**技术要点**:
```js
const { remote } = require('electron');
// 或
const { dialog } = require('@electron/remote');

const result = await dialog.showOpenDialog({
    title: '选择导出目录',
    properties: ['openDirectory']
});
if (!result.canceled && result.filePaths.length > 0) {
    // result.filePaths[0] 即为所选文件夹的绝对路径
}
```

### 4.2 右键菜单与命令中文化 (UX-02)

**问题**: 插件命令显示为英文（"Batch Export All Dialogues"、"Export current .ncanvas dialogue" 等），中文用户不友好。

**需求**: 所有面向用户的文本改为中文：
- 命令名称: `Batch Export All Dialogues` → `批量导出所有对话`
- 命令名称: `Export current .ncanvas dialogue` → `导出当前 .ncanvas 对话`
- 命令名称: `Validate Flow→Dialogue references` → `验证 Flow→Dialogue 引用完整性`
- 右键菜单: 如有，同步中文化
- 状态栏提示: `Exporting...` → `导出中...` 等
- 设置页面标题和描述文字

**影响范围**: `plugins/narrative-project/src/main.js` (addCommand)、`plugins/dialogue-export/src/main.js`、`status-bar.js`、`settings.js`

### 4.3 自动导出状态反馈优化 (UX-03)

**当前**: 保存 `.ncanvas` 后自动导出，状态栏短暂显示结果后自动消失。

**可优化点**:
- 导出失败时，状态栏应显示具体错误（当前已部分支持）
- 考虑是否在导出成功后显示文件路径
- 批量导出时显示进度（x/n 完成）

---

## 5. 待确认的架构决策

以下问题需要在 discuss-phase 中明确：

| # | 决策点 | 选项 |
|---|--------|------|
| D1 | 是否合并 3 插件为 1？ | A: 合并为 `narrative-tool` / B: 保留 3 插件但修复依赖关系 / C: 3 插件 + 运行时引用替代内联打包 |
| D2 | Choice 循环返回：Canvas 上用户如何表达"返回 Choice"的意图？ | A: 画环到 Choice 节点 / B: 画到 Choice 前的 Marker 节点 / C: 节点属性里设置 goto 目标 |
| D3 | 共享内容去重：汇合点 Marker 由谁命名？ | A: 用户手动放 Marker 节点 / B: 引擎自动生成（如 `~ merge_01`）/ C: 混合（优先读取已有 Marker） |
| D4 | `output/` vs `dist/` vs 其他目录名？ | 倾向于 `output/`（用户已提议） |
| D5 | Electron dialog API 在目标 Obsidian 版本是否可用？ | 需测试目标环境 |

---

## 优先级建议

| 优先级 | 需求 | 理由 |
|:---:|------|------|
| P0 | UX-02 中文化 | 零风险、立即改善体验 |
| P0 | ENG-02 output 目录 | 消除部署混乱 |
| P0 | ENG-03 构建脚本 | 消除编译遗漏 |
| P1 | UX-01 浏览按钮 | 高频使用、易出错 |
| P1 | FEAT-01 Choice 循环 | 剧情设计刚需 |
| P1 | FEAT-02 共享去重 | 减少导出文件体积、可读性 |
| P2 | ENG-01 插件合并 | 重要但需讨论方案 |
| P2 | UX-03 状态反馈优化 | 锦上添花 |

---

*Created: 2026-08-06 | Next: gsd-discuss*

---

## 6. v0.1 里程碑审计 — 已知差距（2026-08-06）

以下差距在 v0.1 里程碑完成审计中发现，已确认并推迟到下一里程碑修复。

### 6.1 未满足需求

| REQ-ID | 描述 | 状态 | 详情 |
|--------|------|------|------|
| ENT-03 | Quest Markdown 模板 | ❌ 代码已删除 | `createQuestMd` 函数已从 `entity-templates.js` 中移除；golden file `tests/fixtures/expected-quest.md` 已删除；FlowToolsPlugin 中未注册 Create Quest 命令。原始实现在 commit `11005f8` 中存在，后续被移除。 |

### 6.2 部分实现

| REQ-ID | 描述 | 状态 | 详情 |
|--------|------|------|------|
| FLW-03 | Canvas 节点类型视觉区分 | ⚠️ 部分 | CSS 仅对 .ncanvas dialogue 节点提供蓝色左边框；entity .md 节点依赖 Obsidian Canvas 内置 color 属性，未激活 CSS `data-nt-type` 规则。`styles.css` 中已定义了完整规则（character/location/quest/item），但未在运行时注入。 |
| FLW-06 | Flow 文件菜单集成 | ⚠️ 部分 | 右键菜单缺少 "Add quest node" 项。仅有 3 种实体节点（character/location/item），与计划的 4 种不符。 |

### 6.3 阶段验证状态

所有 4 个阶段均缺少 VERIFICATION.md — 未经过正式的目标达成验证：

| 阶段 | SUMMARY.md | VERIFICATION.md | UAT.md |
|------|-----------|-----------------|--------|
| Phase 1 — Project Foundation | 3/3 ✅ | ❌ 缺失 | ✅ 存在 |
| Phase 2 — Dialogue Export | 3/3 ✅ | ❌ 缺失 | ✅ 存在 |
| Phase 3 — Entities + Flow Tools | 3/3 ✅ | ❌ 缺失 | ✅ 存在 |
| Phase 4 — Narrative Project | 3/3 ✅ | ❌ 缺失 | ✅ 存在 |

### 6.4 Nyquist 验证覆盖

全部 4 个阶段 VALIDATION.md 缺失 — Nyquist 测试覆盖率为 0%。

| 阶段 | VALIDATION.md | 操作 |
|------|---------------|------|
| 01-foundation | ❌ 缺失 | `/gsd:validate-phase 1` |
| 02-dialogue-export | ❌ 缺失 | `/gsd:validate-phase 2` |
| 03-entities-flow | ❌ 缺失 | `/gsd:validate-phase 3` |
| 04-narrative-project | ❌ 缺失 | `/gsd:validate-phase 4` |

### 6.5 技术债务清单（Phase 3）

| # | 项目 | 影响 | 建议 |
|---|------|------|------|
| 1 | Quest 实体模板缺失 (ENT-03) | 用户无法通过命令面板创建 Quest .md | 恢复 `createQuestMd` + 导入 + 命令注册 |
| 2 | Flow Canvas/Fragment 简化 | 创建仅含标题节点，无预配置模板 | 实现模板选择对话框（Chapter/Quest/World Event 等） |
| 3 | Entity CSS 未激活 | .md 文件节点无 data-nt-type 视觉区分 | 在 `_annotateAllCanvasViews()` 中为 .md 节点设置 `data-nt-type="entity"` |
| 4 | 轮询替代 MutationObserver | CPU 基线略高（每秒扫描） | 迁移到 MutationObserver 方案（已在 plan 中设计） |
| 5 | CSS 内联在 main.js | 独立的 styles.css 文件未被运行时使用 | 切换为 esbuild text loader 或运行时文件读取 |

### 6.6 集成检查

跨阶段接口验证状态：

| 接口 | 状态 |
|------|------|
| Phase 1 shared/gd-constants.js → Phase 2 export-engine.js | ✅ 正常 |
| Phase 1 shared/schema/ → Phase 3 entity-templates.js | ⚠️ Quest schema 未被使用 |
| Phase 2 export engine → Phase 4 batch-export.js | ✅ 正常 |
| Phase 2 export engine → Phase 4 auto-export.js | ✅ 正常 |
| Phase 3 Flow .canvas → Phase 4 reference-validator.js | ✅ 正常 |

### 6.7 集成检查深入发现（2026-08-06）

自动化集成检查器发现以下额外问题：

#### BLOCKER 级别

| # | 问题 | 影响文件 | 影响需求 |
|---|------|----------|----------|
| B1 | `batch-export.js` 忽略 `exportPath`，始终写入 vault 根目录 | `plugins/narrative-project/src/batch-export.js` | PRJ-02, PRJ-01 |
| B2 | `auto-export.js` `exportSingleFile` 忽略 `exportPath`，始终写入源文件旁 | `plugins/narrative-project/src/auto-export.js` | PRJ-03, PRJ-01 |
| B3 | Canvas 模板函数 (createFlowCanvas/createFlowFragment) 完全未接入 main.js | `plugins/flow-tools/src/main.js` | FLW-01, FLW-02 |

**B1/B2 根因:** `exportPath` 参数被正确传递到函数，但函数体内未使用。batch-export 写入 `file.basename + '.dialogue'`（vault 根目录），auto-export 写入 `file.path.replace(/\.ncanvas$/, '.dialogue')`（源文件旁）。

**B3 根因:** `canvas-templates.js` 导出 `createFlowCanvas`（3 种模板）和 `createFlowFragment`（2 种模板），通过 12 个 golden file 测试，但 `main.js` 未导入。`_createFlowCanvasFromCommand` 和 `_createFlowFragmentFromCommand` 使用内联最小 JSON。

#### WARNING 级别

| # | 问题 | 详情 |
|---|------|------|
| W1 | Quest schema 孤立 | `shared/schema/quest.js` 存在但无生产消费者 |
| W2 | 反向导航 (FLW-05) 未接入 | `openFlowCanvas` 存在于 navigation.js 但未被 main.js 导入 |
| W3 | main.js 中有误导性注释 | 导入头注释引用了实际未导入的模块 |
| W4 | batch-export.js 注释与代码不一致 | JSDoc 声称写入 exportPath，代码写入 vault 根目录 |
| W5 | openFileInSplit 被导入但死代码 | main.js 第 17 行解构了该函数但从未调用 |

#### E2E 流程状态

| 流程 | 状态 |
|------|------|
| F1: 创建对话 + 导出 | ⚠️ 可用但 auto-export 忽略 Export Path |
| F2: 批量导出所有对话 | ❌ 始终写入 vault 根目录 |
| F3: 创建实体 + 添加到 Canvas | ✅ Quest 创建缺失 |
| F4: Flow Canvas → 打开对话 | ✅ 正常 |
| F5: Dialogue → 返回 Flow | ❌ 未接入任何命令/菜单 |
| F6: 引用验证 | ✅ 正常 |
| F7: 创建 Flow Canvas（模板） | ❌ 模板函数未接入 |

#### 孤立导出（9 项）

`topologicalSort`, `resolveCharacter`, `QuestTemplate/QuestFields/QuestRequired`, `FLOW_TEMPLATES`, `FRAGMENT_TEMPLATES`, `createFlowCanvas`, `createFlowFragment`, `createCanvas`, `addDialogueNodeToCanvas`, `openFlowCanvas`, `openFileInSplit`(部分), `ensureDirectory`

以上函数/常量均已导出并通过测试，但生产代码中无消费者。

---
*Appended: 2026-08-06 after v0.1 milestone audit*
*Updated: 2026-08-06 — integration checker findings added*
