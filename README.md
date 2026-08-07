# Obsidian Narrative Toolchain

一套面向叙事策划的 Obsidian 插件工具链，用于在 Obsidian 内完成从世界观组织、剧情流程设计到 Godot Dialogue Manager 导出的完整叙事工作流。

> **版本说明（2026-08-06 起）：** 原有的三个插件（`flow-tools` / `dialogue-export` / `narrative-project`）已合并为单一插件 **`narrative-tool`**。旧插件的设置会在首次加载时自动迁移。本文档描述合并后的架构。

## 目录

- [系统架构](#系统架构)
- [安装与配置](#安装与配置)
- [插件详解：Narrative Tool](#插件详解narrative-tool)
- [推荐目录结构](#推荐目录结构)
- [工作流示例](#工作流示例)
- [文件格式说明](#文件格式说明)
- [开发](#开发)

---

## 系统架构

```
Flow (.canvas)
    ↓
Flow Fragment (.canvas)
    ↓
Dialogue (.ncanvas)
    ↓
Dialogue Fragment (Narrative Canvas Node)
```

- **Flow 层**：使用 Obsidian 原生 Canvas（`.canvas`），负责章节、任务流程、世界事件等宏观流程
- **Flow Fragment 层**：继续使用 Canvas，负责某个大型流程中的局部子流程
- **Dialogue 层**：使用 Narrative Canvas（`.ncanvas`），负责单次完整对话编辑
- **Dialogue Fragment 层**：Narrative Canvas 的单个节点，如 NPC 对话、玩家选择等

---

## 安装与配置

### 前置要求

- Obsidian ≥ 1.5.0
- 已安装 [Narrative Canvas](https://github.com/nicolering/NarrativeCanvas) 插件（负责 `.ncanvas` 文件的编辑）

### 安装步骤

1. 将 `plugins/narrative-tool/` 目录复制到你的 Obsidian Vault 的 `.obsidian/plugins/` 目录下：

   ```
   .obsidian/plugins/
   └── narrative-tool/
       ├── main.js
       ├── manifest.json
       └── styles.css
   ```

2. 重启 Obsidian 或手动刷新插件列表
3. 在 **设置 → 第三方插件** 中启用 **Narrative Tool**（插件 ID：`narrative-tool`）

### 从旧版三插件升级

如果之前安装过 `flow-tools` / `dialogue-export` / `narrative-project` 三个旧插件：

- 首次加载 `narrative-tool` 时，会自动读取三个旧插件的 `data.json` 并迁移设置（仅迁移一次，不会覆盖后续修改）
- 旧的命令 ID（如 `dialogue-export:export-current-dialogue`）已统一为 `narrative-tool:` 前缀，**旧的热键绑定需要重新设置**
- 迁移完成后可删除三个旧插件目录

---

## 插件详解：Narrative Tool

单一插件承担全部职责：实体创建、Flow Canvas 管理、对话导出（单文件/批量/自动）、引用校验、项目设置。

### 可用指令（共 10 个，命令面板 `Ctrl/Cmd+P` 调用）

| 命令名称 | 命令 ID | 功能 |
|---------|---------|------|
| 导出当前对话 | `narrative-tool:export-current-dialogue` | 将当前打开的 `.ncanvas` 导出为 `.dialogue` |
| 批量导出所有对话 | `narrative-tool:batch-export-all-dialogues` | 扫描导出范围内所有 `.ncanvas` 并批量导出（状态栏显示 x/n 进度） |
| 验证 Flow→对话引用 | `narrative-tool:validate-references` | 检查所有 `.canvas` 中的 `.ncanvas` 引用是否断链 |
| 创建角色 | `narrative-tool:create-character` | 在 `Characters/` 下创建角色档案 |
| 创建地点 | `narrative-tool:create-location` | 在 `Locations/` 下创建地点档案 |
| 创建物品 | `narrative-tool:create-item` | 在 `Items/` 下创建道具档案 |
| 创建任务 | `narrative-tool:create-quest` | 在 `Quests/` 下创建任务档案 |
| 创建 Flow | `narrative-tool:create-flow-canvas` | 输入名称，创建 `Flows/<名称>.canvas`（含标题节点）及同名 Fragment 文件夹 |
| 创建 Flow 片段 | `narrative-tool:create-flow-fragment` | 选择父 Flow Canvas 后输入名称，在父 Flow 同名文件夹下创建片段，并自动在父 Canvas 中添加引用节点 |
| 打开 Flow 画布 | `narrative-tool:open-flow-canvas` | 从当前 `.ncanvas` 反向导航到引用它的 Flow Canvas |

> 命令 ID 保持英文不变，已配置的快捷键不受影响。

### 右键菜单

**在 `.canvas` 文件上右键（6 项）：**

| 菜单项 | 功能 |
|--------|------|
| 添加对话节点 | 选择已有 `.ncanvas` 文件，添加为对话节点 |
| 添加角色节点 | 从 `Characters/` 选择角色，添加为节点（绿色） |
| 添加地点节点 | 从 `Locations/` 选择地点，添加为节点（橙色） |
| 添加物品节点 | 从 `Items/` 选择道具，添加为节点（红色） |
| 添加任务节点 | 从 `Quests/` 选择任务，添加为节点（紫色） |
| 打开关联对话 | 打开当前 Canvas 引用的 `.ncanvas` 对话文件 |

**在 `.ncanvas` 文件上右键（1 项）：**

| 菜单项 | 功能 |
|--------|------|
| 打开 Flow 画布 | 反向导航到引用该对话的 Flow Canvas |

### 导出功能

- **支持节点类型**：Entry（入口）、Dialog（对话）、Content（内容）、Choice（选择分支）、Marker（标记）、Event（事件）
- **角色名解析**：自动从节点的 `cast` 字段解析说话角色名；正文中已有的 `角色: 文本` 前缀（含全角冒号 `：`）不会重复添加
- **分支嵌套**：Choice 节点自动生成缩进的分支结构，支持嵌套选择
- **MED 扩展**：支持 `set_flag`、`[#check]`、`[term]` 等 MED 状态管理语法（可在设置中开关）
- **导出位置**：由设置中的 **导出路径** 控制（相对或绝对路径），三种导出方式（单文件/批量/自动）统一遵循

### 自动导出

- 在 Narrative Canvas 中保存 `.ncanvas` 文件后，自动导出为 `.dialogue`
- 防抖延迟 2 秒，写入配置的导出路径
- 状态栏显示结果（失败时含具体错误），5 秒后自动恢复

### 设置项（设置 → 第三方插件 → Narrative Tool）

| 设置项 | 说明 | 默认值 |
|-------|------|--------|
| **导出路径** | 导出目录，支持 Vault 相对路径（如 `Exports/`）或绝对路径（如 `D:/Godot/dialogues/`）。留空则在 `.ncanvas` 同目录导出。点 **浏览…** 按钮可弹出系统文件夹选择器直接选择 | `Exports` |
| **MED 扩展语法** | 是否在导出中包含 MED 状态扩展语法 | 开启 |
| **导出范围目录** | 批量导出的扫描范围，`/` 表示整个 Vault | `/` |

### 视觉效果

- **对话节点**：指向 `.ncanvas` 文件的节点左侧显示蓝色边框（`data-nt-type="dialogue"`）
- **实体节点**：指向 `.md` 实体档案的节点按类型着色，并有 `data-nt-type` 视觉区分

---

## 推荐目录结构

```
MyGameVault/
├── Flows/                    # 流程画布（.canvas）
│   ├── Chapter1.canvas       # 第一章主流程
│   └── Chapter1/             # 第一章子流程
│       └── VillageEncounter.canvas
├── Dialogues/                # 对话文件（.ncanvas）
│   ├── InnkeeperGreeting.ncanvas
│   └── ShopKeeper.ncanvas
├── Characters/               # 角色档案（.md）
├── Locations/                # 地点档案（.md）
├── Items/                    # 道具档案（.md）
├── Quests/                   # 任务档案（.md）
├── Exports/                  # 导出的 .dialogue 文件
└── .obsidian/                # Obsidian 配置（含插件）
```

---

## 工作流示例

### 从零开始搭建一条剧情线

1. **创建实体档案**
   - `Ctrl+P` → `创建角色` → 输入 ID 和名称 → 自动生成 `Characters/<id>.md`
   - `Ctrl+P` → `创建地点` → 生成 `Locations/<id>.md`

2. **创建流程画布**
   - `Ctrl+P` → `创建 Flow` → 输入名称 "Chapter1" → 生成 `Flows/Chapter1.canvas` + `Flows/Chapter1/` 文件夹

3. **在流程中添加实体节点**
   - 在文件列表中右键 `Flows/Chapter1.canvas` → `添加角色节点` → 选择角色

4. **在流程中挂载对话**
   - 右键 `Flows/Chapter1.canvas` → `添加对话节点` → 选择 `.ncanvas` 文件

5. **编辑对话**
   - 双击 Canvas 中的对话节点，在 Narrative Canvas 编辑器中编写对话内容

6. **导出对话**
   - 单文件：打开 `.ncanvas` → `Ctrl+P` → `导出当前对话`
   - 自动：保存 `.ncanvas` 后自动导出
   - 批量：`Ctrl+P` → `批量导出所有对话`

7. **校验引用完整性**
   - `Ctrl+P` → `验证 Flow→对话引用`

8. **反向导航**
   - 在 `.ncanvas` 文件上右键 → `打开 Flow 画布`，跳回所属 Flow Canvas

---

## 文件格式说明

### 实体 Markdown（Characters/Locations/Items/Quests）

所有实体文件均使用 YAML Frontmatter 存储结构化数据，正文为 Markdown 自由文本。例如角色文件：

```markdown
---
id: "lvdian-laoban"
name: "旅店老板"
role: "NPC"
voice: "粗犷"
appearance_scenes: ["起始村庄"]
tags: [character]
---

# 旅店老板

**Role:** NPC
**Voice:** 粗犷

## Notes

旅店老板是一个热情好客的中年男子...
```

### Dialogue 导出格式（.dialogue）

导出文件遵循 Godot Dialogue Manager 语法：

```gdscript
~ title_name

Character: 这是角色的对话行。
	More lines inside the same dialogue balloon.
- Character: This is a choice line.
	Some choice dialogue.
- Character: Another choice.
	More choice dialogue.
=> END
```

---

## 开发

```bash
# 根目录一键构建：esbuild 编译 narrative-tool + 重建定制版 Narrative Canvas，
# 部署产物到 output/narrative-tool/ 和 output/narrative-canvas/
# （首次需先 npm --prefix plugins/narrative-tool install）
npm run build

# 运行全部测试（node:test）
npm test
```

- **部署**：构建后复制 `output/narrative-tool/`（main.js + manifest.json + styles.css）到任意 vault 的 `.obsidian/plugins/` 即可
- **导出引擎**（`plugins/narrative-tool/src/engine/`）是纯数据转换，零 Obsidian 依赖，可脱离 Obsidian 用 `node --test` 直接测试
- golden 导出文件作为回归契约，保证导出格式字节一致
- 项目管理文档见 `.planning/`（ROADMAP / STATE / REQUIREMENTS），交接说明见 `HANDOVER.md`

---

## 设计原则

1. **复用 Obsidian 原生能力** — Flow 层优先使用原生 Canvas，不重复造轮子
2. **职责分离** — 导出引擎为纯函数，与 Obsidian 运行时解耦
3. **纯文件存储** — 所有数据保存在普通文件中，避免数据库或专有格式
4. **社区兼容** — 保持与 Obsidian 社区生态兼容，便于升级维护
5. **渐进增强** — Narrative Canvas 核心编辑器不做修改，通过外围插件扩展功能
