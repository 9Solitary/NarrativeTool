# 插件清单与维护状态

本文件记录各插件/编辑器的状态，**动手改代码前先看这里**，避免把功能做进已弃用的组件。

## 正式维护（新功能和修复都改这里）

| 组件 | 位置 | 职责 |
|---|---|---|
| Narrative Tool | `plugins/narrative-tool/`（源码 `src/`） | 导出引擎（.ncanvas → Godot DM .dialogue）、导出命令、自动导出、告警展示 |
| Narrative Graph | `plugins/narrative-graph/`（源码 `src/`） | .ncanvas 节点图画布编辑器（正式版），画布交互/搜索/连线锚点等编辑器功能改这里 |

两者均由根目录 `npm run build` 构建并拷入 `output/`。

## 已弃用（仅存档，禁止加新功能、禁止以此验证功能）

| 组件 | 位置 | 说明 |
|---|---|---|
| NarrativeCanvas | `NarrativeCanvas/` | 旧版画布编辑器，已被 narrative-graph 取代。**本地保留不进仓库**（.gitignore），不要在正式运行环境中启用 |
| dialogue-export | `plugins/dialogue-export/` | 旧导出插件，只有 main.js 打包产物、无源码；导出引擎为旧版，含环画布必崩 |
| narrative-project | `plugins/narrative-project/` | 旧工程插件，同上（无源码、旧引擎） |
| flow-tools | `plugins/flow-tools/` | 旧 Flow 工具，同上（无源码） |

## 规则

1. 编辑器功能（画布、节点、连线、搜索）→ 只改 `plugins/narrative-graph/`。
2. 导出与告警 → 只改 `plugins/narrative-tool/`（引擎是 `src/engine/` 纯数据层，可 `node --test` 直测）。
3. 已弃用组件里的代码只读参考，不回改、不部署。
4. 新增插件或变更状态时，同步更新本文件。
