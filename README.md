# Obsidian Narrative Toolchain

一套面向叙事策划的 Obsidian 插件工具链，用于在 Obsidian 内完成从世界观组织、剧情流程设计到 Godot Dialogue Manager 导出的完整叙事工作流。

## 目录

- [系统架构](#系统架构)
- [安装与配置](#安装与配置)
- [插件详解](#插件详解)
  - [Flow Tools（流程工具）](#flow-tools流程工具)
  - [Dialogue Export（对话导出）](#dialogue-export对话导出)
  - [Narrative Project（项目管理）](#narrative-project项目管理)
- [推荐目录结构](#推荐目录结构)
- [工作流示例](#工作流示例)
- [文件格式说明](#文件格式说明)

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

1. 将 `plugins/` 目录下的三个插件文件夹复制到你的 Obsidian Vault 的 `.obsidian/plugins/` 目录下：

   ```
   .obsidian/plugins/
   ├── flow-tools/
   ├── dialogue-export/
   └── narrative-project/
   ```

2. 重启 Obsidian 或手动刷新插件列表
3. 在 **设置 → 第三方插件** 中启用以下三个插件：

| 插件名称 | 插件 ID | 用途 |
|---------|---------|------|
| Flow Tools | `flow-tools` | 流程管理、实体创建、导航 |
| Dialogue Export | `dialogue-export` | 单文件对话导出 |
| Narrative Project | `narrative-project` | 项目配置、批量导出、自动导出、引用校验 |

---

## 插件详解

### Flow Tools（流程工具）

负责 Flow Canvas 管理、叙事实体创建和跨文件导航。

#### 可用指令

##### 1. 创建角色（Create Character）

- **指令 ID**：`create-character`
- **如何调用**：命令面板（`Ctrl/Cmd+P`）→ 输入 "Create Character"
- **功能**：弹出输入框，输入角色名称后自动在 `Characters/` 目录下生成带 YAML Frontmatter 的 Markdown 文件
- **生成文件位置**：`Characters/<角色名>.md`
- **文件内容**：包含 `id`、`name`、`role`、`voice`、`appearance_scenes` 等字段

##### 2. 创建地点（Create Location）

- **指令 ID**：`create-location`
- **如何调用**：命令面板 → 输入 "Create Location"
- **功能**：输入地点名称，在 `Locations/` 目录下生成地点 Markdown 文件
- **生成文件位置**：`Locations/<地点名>.md`
- **文件内容**：包含 `id`、`name`、`description`、`region`、`connected_locations` 等字段

##### 3. 创建道具（Create Item）

- **指令 ID**：`create-item`
- **如何调用**：命令面板 → 输入 "Create Item"
- **功能**：输入道具名称，在 `Items/` 目录下生成道具 Markdown 文件
- **生成文件位置**：`Items/<道具名>.md`
- **文件内容**：包含 `id`、`name`、`description`、`item_type`、`related_quest_id`、`owner_character_id` 等字段

##### 4. 创建流程画布（Create Flow Canvas）

- **指令 ID**：`create-flow-canvas`
- **如何调用**：命令面板 → 输入 "Create Flow Canvas"
- **功能**：输入流程名称后，在 `Flows/` 目录下创建一个空白的 `.canvas` 文件
- **生成文件位置**：`Flows/<流程名>.canvas`
- **说明**：创建的 Canvas 包含一个初始标题节点，后续可通过右键菜单添加更多节点

##### 5. 创建流程片段（Create Flow Fragment）

- **指令 ID**：`create-flow-fragment`
- **如何调用**：命令面板 → 输入 "Create Flow Fragment"
- **功能**：首先选择父级 Flow Canvas，然后输入片段名称，在父流程目录下创建子 Canvas
- **生成文件位置**：`Flows/<父流程名>/<片段名>.canvas`
- **说明**：自动将片段节点同步回父 Flow Canvas 中

#### 右键菜单功能（在 .canvas 文件上右键）

##### 6. 创建对话节点（Create dialogue node）

- **触发方式**：在 `.canvas` 文件上右键 → 选择 "Create dialogue node"
- **功能**：输入对话名称后创建一个 `.ncanvas` 文件，并自动将其作为节点添加到当前 Canvas 中
- **生成文件位置**：`<Canvas所在目录>/<Canvas名称>/<对话名>.ncanvas`

##### 7. 添加角色节点（Add character node）

- **触发方式**：在 `.canvas` 文件上右键 → 选择 "Add character node"
- **功能**：弹出模糊搜索框，从 `Characters/` 目录中选择已有角色 `.md` 文件，将其添加为 Canvas 节点
- **节点颜色**：绿色（Obsidian Canvas 默认分组色）

##### 8. 添加地点节点（Add location node）

- **触发方式**：在 `.canvas` 文件上右键 → 选择 "Add location node"
- **功能**：从 `Locations/` 目录中选择已有地点文件，添加为 Canvas 节点
- **节点颜色**：橙色

##### 9. 打开关联对话（Open linked dialogue）

- **触发方式**：在 `.canvas` 文件上右键 → 选择 "Open linked dialogue"
- **功能**：解析当前 Canvas 中所有指向 `.ncanvas` 文件的节点，在分栏中打开对应的对话文件
- **说明**：如果只有一个对话节点，直接打开；多个则弹出选择列表

#### 视觉效果

- **对话节点标识**：Canvas 中指向 `.ncanvas` 文件的节点左侧会显示蓝色边框，便于快速区分
- **实体节点颜色**：角色（绿）、地点（橙）、道具（红），使用 Obsidian Canvas 内置颜色分组

---

### Dialogue Export（对话导出）

负责将 Narrative Canvas（`.ncanvas`）文件导出为 Godot Dialogue Manager 的 `.dialogue` 格式。

#### 可用指令

##### 1. 导出当前对话（Export current dialogue）

- **指令 ID**：`export-current-dialogue`
- **如何调用**：打开一个 `.ncanvas` 文件 → 命令面板 → 输入 "Export current dialogue"
- **功能**：将当前活动的 `.ncanvas` 文件导出为 `.dialogue` 文件
- **导出位置**：
  - 如果在 Narrative Project 中配置了 `Export Path`（绝对路径），则导出到该路径
  - 否则导出到 `.ncanvas` 文件的同目录下（同名 `.dialogue` 文件）
- **支持格式**：Godot Dialogue Manager 标准语法 + MED（Modern Event Dialogue）状态扩展

#### 导出格式说明

- **支持节点类型**：Entry（入口）、Dialog（对话）、Content（内容）、Choice（选择分支）、Marker（标记）、Event（事件）
- **角色名解析**：自动从节点的 `cast` 字段解析说话角色名
- **分支嵌套**：Choice 节点自动生成缩进的分支结构，支持嵌套选择
- **MED 扩展**：支持 `set_flag`、`[#check]`、`[term]` 等 MED 状态管理语法（可在 Narrative Project 设置中开关）

---

### Narrative Project（项目管理）

项目级配置与协调中心，提供批量导出、自动导出、引用校验和设置管理。

#### 可用指令

##### 1. 批量导出所有对话（Batch Export All Dialogues）

- **指令 ID**：`batch-export-all-dialogues`
- **如何调用**：命令面板 → 输入 "Batch Export All Dialogues"
- **功能**：扫描 Vault 中所有 `.ncanvas` 文件，逐个导出为 `.dialogue` 文件
- **导出范围**：由设置中的 `Export Scope` 控制，默认为 `/`（整个 Vault）
- **状态反馈**：底部状态栏显示导出进度和结果

##### 2. 导出当前 .ncanvas 对话（Export current .ncanvas dialogue）

- **指令 ID**：`export-current-dialogue`
- **如何调用**：打开一个 `.ncanvas` 文件 → 命令面板 → 输入 "Export current .ncanvas dialogue"
- **功能**：导出当前活动文件（与 Dialogue Export 插件类似，但使用 Narrative Project 的配置路径）
- **状态反馈**：状态栏显示导出结果

##### 3. 校验 Flow→Dialogue 引用（Validate Flow→Dialogue references）

- **指令 ID**：`validate-references`
- **如何调用**：命令面板 → 输入 "Validate Flow→Dialogue references"
- **功能**：扫描所有 `.canvas` 文件中指向 `.ncanvas` 的引用，检查目标文件是否存在
- **报告内容**：总引用数、断链数、详细断链列表（Canvas 路径 + 缺失文件路径）
- **输出位置**：状态栏摘要 + Obsidian 通知 + 控制台详细输出（`Ctrl+Shift+I`）

#### 设置项（设置 → 第三方插件 → Narrative Project）

| 设置项 | 说明 | 默认值 |
|-------|------|--------|
| **Export Path** | 导出目录，支持绝对路径（如 `D:/Godot/dialogues/`）或 Vault 相对路径（如 `Exports/`）。留空则在 `.ncanvas` 同目录导出 | `Exports` |
| **MED Enabled** | 是否在导出中包含 MED 状态扩展语法（`S`、`do set_flag`、`[#check]` 等） | 开启 |
| **Export Scope** | 批量导出的扫描范围，`/` 表示整个 Vault | `/` |

#### 自动导出功能

- **工作原理**：当你在 Narrative Canvas 中编辑并保存 `.ncanvas` 文件时，插件会自动将其导出为 `.dialogue` 文件
- **防抖延迟**：2 秒（连续快速保存会合并为一次导出）
- **导出位置**：`.ncanvas` 文件同目录（同名 `.dialogue`）
- **状态反馈**：导出成功后状态栏显示绿色提示，5 秒后自动恢复

---

## 推荐目录结构

```
MyGameVault/
├── Flows/                    # 流程画布（.canvas）
│   ├── Chapter1.canvas       # 第一章主流程
│   ├── Chapter2.canvas       # 第二章主流程
│   └── Chapter1/             # 第一章子流程
│       └── VillageEncounter.canvas
├── Dialogues/                # 对话文件（.ncanvas）
│   ├── InnkeeperGreeting.ncanvas
│   └── ShopKeeper.ncanvas
├── Characters/               # 角色档案（.md）
│   ├── 主角.md
│   └── 旅店老板.md
├── Locations/                # 地点档案（.md）
│   ├── 起始村庄.md
│   └── 神秘森林.md
├── Items/                    # 道具档案（.md）
│   ├── 老旧钥匙.md
│   └── 治疗药水.md
├── Exports/                  # 导出的 .dialogue 文件
│   ├── InnkeeperGreeting.dialogue
│   └── ShopKeeper.dialogue
└── .obsidian/                # Obsidian 配置（含插件）
```

---

## 工作流示例

### 从零开始搭建一条剧情线

1. **创建实体档案**
   - `Ctrl+P` → `Create Character` → 输入 "旅店老板" → 自动生成 `Characters/旅店老板.md`
   - `Ctrl+P` → `Create Location` → 输入 "起始村庄" → 生成 `Locations/起始村庄.md`

2. **创建流程画布**
   - `Ctrl+P` → `Create Flow Canvas` → 输入 "Chapter1" → 生成 `Flows/Chapter1.canvas`

3. **在流程中添加实体节点**
   - 在文件列表中右键 `Flows/Chapter1.canvas` → `Add character node` → 选择 "旅店老板"
   - 右键 → `Add location node` → 选择 "起始村庄"

4. **在流程中创建对话**
   - 右键 `Flows/Chapter1.canvas` → `Create dialogue node` → 输入 "旅店老板问候"
   - 自动创建 `Flows/Chapter1/旅店老板问候.ncanvas` 并显示在 Canvas 上

5. **编辑对话**
   - 双击 Canvas 中的对话节点，在 Narrative Canvas 编辑器中编写对话内容

6. **导出对话**
   - 方式一（单文件）：打开 `.ncanvas` 文件 → `Ctrl+P` → `Export current dialogue`
   - 方式二（自动）：保存 `.ncanvas` 文件后自动导出（需 Narrative Project 插件启用）
   - 方式三（批量）：`Ctrl+P` → `Batch Export All Dialogues` → 一次性导出所有对话

7. **校验引用完整性**
   - `Ctrl+P` → `Validate Flow→Dialogue references` → 确认所有引用正常

8. **查看导出的 .dialogue 文件**
   - 在 `Exports/` 目录中查看生成的 `.dialogue` 文件，可直接用于 Godot Dialogue Manager

---

## 文件格式说明

### 实体 Markdown（Characters/Locations/Items）

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
	More lines inside the same dialogue balloon. Effect inside the balloon.
- Character: This is a choice line.
	Some choice dialogue.
- Character: Another choice.
	More choice dialogue.
=> END
```

---

## 设计原则

1. **复用 Obsidian 原生能力** — Flow 层优先使用原生 Canvas，不重复造轮子
2. **职责分离** — 导出逻辑与编辑逻辑解耦，每个插件职责单一
3. **纯文件存储** — 所有数据保存在普通文件中，避免数据库或专有格式
4. **社区兼容** — 保持与 Obsidian 社区生态兼容，便于升级维护
5. **渐进增强** — Narrative Canvas 核心编辑器尽量少修改，通过外围插件扩展功能
