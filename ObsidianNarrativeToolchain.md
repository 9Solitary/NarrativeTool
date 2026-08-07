# GSD Project - Obsidian Narrative Toolchain

## 项目名称（暂定）

Obsidian Narrative Toolchain

------

# 一、项目背景

目前 Narrative Canvas 已经能够较好地承担 **Dialogue → Dialogue Fragment** 层级的编辑工作，因此本项目不准备重新设计 Dialogue 编辑器，而是在此基础上继续扩展，使 Obsidian 能够承担接近 Articy:draft 的叙事设计流程。

最终目标并不是维护一个修改版 Narrative Canvas，而是建立一套完整的 Obsidian Narrative Workflow，使剧情策划能够在 Obsidian 内完成：

- 世界观组织
- 剧情流程设计
- Flow 编辑
- Dialogue 编辑
- 导出至 Godot Dialogue Manager
- Graph 可视化浏览

Narrative Canvas 只是其中负责 Dialogue 编辑的一部分。

------

# 二、项目目标

最终实现如下层级：

```text
Flow
    ↓
Flow Fragment
    ↓
Dialogue
    ↓
Dialogue Fragment
```

其中：

Dialogue 与 Dialogue Fragment 已由 Narrative Canvas 实现，本项目主要实现上层结构及导出流程。

------

# 三、当前已有能力

## Narrative Canvas

已具备：

- Dialogue 编辑
- Dialogue Fragment 编辑
- Dialogue Branch
- 节点连接
- 节点属性
- Obsidian Plugin

当前阶段暂不修改其 Dialogue 编辑逻辑。

------

## Obsidian Canvas

经过验证：

- .canvas 可以拖入 .ncanvas
- 可以作为流程节点引用 Dialogue
- 目前仅显示标题
- 已满足作为 Flow 图使用的最低要求

因此 Flow 层优先采用原生 Canvas，而不是重新实现。

------

# 四、系统架构

## Layer 1

Flow

使用：

```text
.canvas
```

负责：

- 游戏章节
- 任务流程
- 世界事件
- 地图跳转
- Quest Flow

每个节点可以链接：

- Flow Fragment
- Dialogue
- Markdown
- Character
- Quest

------

## Layer 2

Flow Fragment

负责：

某个大型流程中的局部流程。

例如：

```text
Chapter 1

↓

Village

↓

Inn

↓

NPC
```

Flow Fragment 可以采用以下两种方案（二选一）：

方案 A（推荐）

继续使用：

```text
.canvas
```

优点：

- 完全兼容 Obsidian
- 无需维护额外编辑器
- Graph 天然支持

方案 B

扩展 Narrative Canvas

新增：

```text
.fncanvas
```

不推荐，维护成本较高。

当前倾向：

继续使用原生 Canvas。

------

## Layer 3

Dialogue

使用：

```text
.ncanvas
```

负责：

完整一次对话。

例如：

```text
ShopKeeper.ncanvas
```

由 Narrative Canvas 编辑。

当前无需修改。

------

## Layer 4

Dialogue Fragment

即：

Narrative Canvas Node。

例如：

```text
NPC

↓

Player Choice

↓

NPC

↓

Choice
```

当前无需修改。

------

# 五、导出流程

每个：

```text
.ncanvas
```

可以单独导出：

```text
.dialogue
```

目标格式：

Godot Dialogue Manager

同时兼容：

项目自定义扩展字段。

未来希望支持：

- 单文件导出
- 批量导出
- 自动导出

------

# 六、节点跳转

希望支持：

Flow

↓

点击节点

↓

打开：

```text
Dialogue.ncanvas
```

Dialogue

↓

点击引用节点

↓

打开：

```text
Flow.canvas
```

形成：

```text
Flow

↓

Dialogue

↓

Flow

↓

Dialogue
```

双向跳转。

------

# 七、Graph View

所有资源都应被 Graph 正确索引。

包括：

- Flow
- Dialogue
- Character
- Quest
- Location
- Item

最终形成整个项目知识图谱。

------

# 八、项目目录建议

建议不要把所有代码都放进 Narrative Canvas Fork。

推荐建立 Workspace。

```text
NarrativeWorkspace/

├── obsidian-vault/
│
│   ├── Flows/
│   ├── Dialogues/
│   ├── Characters/
│   ├── Locations/
│   ├── Quests/
│   ├── Export/
│   └── .obsidian/
│
├── plugins/
│
│   ├── narrative-canvas/
│   │
│   ├── flow-tools/
│   │
│   ├── export-dialogue/
│   │
│   └── graph-tools/
│
├── shared/
│
│   ├── schema/
│   ├── utils/
│   └── types/
│
├── docs/
│
├── examples/
│
└── scripts/
```

其中：

obsidian-vault

用于真实测试。

plugins

放所有插件源码。

shared

放公共类型。

docs

设计文档。

scripts

导出脚本。

这样以后不会因为 Narrative Canvas 升级导致整个工程难以维护。

------

# 九、插件划分建议

建议不要把所有功能全部塞进 Narrative Canvas。

推荐拆分：

## Plugin 1

Narrative Canvas

职责：

Dialogue 编辑。

尽量少修改。

------

## Plugin 2

Flow Tools

负责：

- Flow 管理
- Flow Fragment
- 快速创建
- 双击打开
- Flow 导航

------

## Plugin 3

Dialogue Export

负责：

```text
.ncanvas

↓

.dialogue
```

支持：

Godot Dialogue Manager。

------

## Plugin 4（后期）

Narrative Project

负责：

- 项目配置
- 自动导出
- Build
- 全局索引
- 项目设置

------

# 十、开发阶段

## Phase 1

建立开发环境

- Obsidian Test Vault
- Narrative Canvas Fork
- 插件热加载

------

## Phase 2

实现 Dialogue Export

目标：

```text
.ncanvas

↓

.dialogue
```

验证 Godot 可读取。

------

## Phase 3

Flow Tools

实现：

- Flow 导航
- Flow Fragment
- 双向跳转

------

## Phase 4

项目管理

实现：

- 批量导出
- Build
- 项目配置
- Graph 增强

------

# 十一、设计原则

1. 尽可能复用 Obsidian 原生能力。
2. 尽可能减少对 Narrative Canvas 核心编辑器的修改。
3. 将导出逻辑与编辑逻辑解耦。
4. 插件职责单一，避免形成大型单体插件。
5. 所有数据均保存在普通文件中，避免数据库或专有格式。
6. 保持与 Obsidian 社区生态兼容，便于未来升级和维护。