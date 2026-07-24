# Requirements: Obsidian Narrative Toolchain

**Defined:** 2026-07-23
**Core Value:** 策划在 Obsidian 中完成 Flow → Dialogue 的全链路编辑，并一键导出为 Godot 可读取的 `.dialogue` 文件。

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Project Foundation

- [x] **FND-01**: 项目工作区结构初始化 — `plugins/`、`shared/`、`obsidian-vault/` 目录
- [x] **FND-02**: 共享模块 `shared/gd-constants.js` — Godot Dialogue Manager + MED 状态系统所有 token 常量
- [x] **FND-03**: 共享模块 `shared/schema/` — 实体类型定义（Character, Location, Quest, Item）
- [x] **FND-04**: esbuild 构建配置 — 将 `src/` 模块打包为单文件 `main.js`
- [x] **FND-05**: Node.js `node:test` 测试基础设施 — fixture 文件驱动的导出测试

### Dialogue Export — Core Engine

- [x] **EXP-01**: 单个 `.ncanvas` 文件导出为 `.dialogue`，兼容 Godot Dialogue Manager 基础语法
- [x] **EXP-02**: 角色名映射 — `.ncanvas` 中的角色名正确输出为 `Character: text` 格式
- [x] **EXP-03**: 对话选项导出 — Narrative Canvas 分支选项输出为 `- option text` 格式
- [x] **EXP-04**: 嵌套分支导出 — 多层级嵌套选项正确输出缩进结构
- [x] **EXP-05**: Cue/Jump 映射 — Narrative Canvas 节点跳转映射为 `~ cue` 和 `=> jump` 语法
- [x] **EXP-06**: Tags 导出 — Narrative Canvas 节点 tag 导出为 `[#tag]` 格式
- [x] **EXP-07**: BBCode 透传 — Narrative Canvas 中的 BBCode 标记保留在导出文本中

### Dialogue Export — MED Extensions

- [ ] **MED-01**: `using S` 声明 — 使用状态系统的对话自动在文件头插入
- [ ] **MED-02**: `do set_flag(id, value)` 导出 — Narrative Canvas 条件分支映射为 flag 设置
- [ ] **MED-03**: `do add_res(id, delta)` 等资源修改语句导出
- [ ] **MED-04**: `[#check=type:id:threshold]` 检定语法导出 — Narrative Canvas 条件节点映射为检定
- [ ] **MED-05**: `[term=id]` 说明词导出 — Narrative Canvas 术语标记映射
- [ ] **MED-06**: `{{res(&"id")}}` 等内联状态显示导出
- [ ] **MED-07**: `~ direct_check` 直接检定导出 — 非选项触发的检定场景
- [ ] **MED-08**: `[if condition]` 选项条件导出 — Narrative Canvas 的条件表达式映射为 MED 条件

### Character & Entity

- [ ] **ENT-01**: Character Markdown 模板 — 符合 Narrative Canvas 导出格式的模板
- [ ] **ENT-02**: Location Markdown 模板 — 地点实体定义
- [ ] **ENT-03**: Quest Markdown 模板 — 任务实体定义
- [ ] **ENT-04**: Item Markdown 模板 — 道具实体定义
- [ ] **ENT-05**: 实体在 Obsidian Graph View 中正确索引和显示

### Flow Tools

- [ ] **FLW-01**: 从模板快速创建 Flow Canvas（章节/任务/世界事件模板）
- [ ] **FLW-02**: 从模板创建 Flow Fragment Canvas（局部流程模板）
- [ ] **FLW-03**: Canvas 节点类型识别 — 区分 `.ncanvas`、`.md`(Character/Location/Quest) 节点并在 Canvas 中显示对应样式
- [ ] **FLW-04**: Flow → Dialogue 导航 — 在 Canvas 中点击 `.ncanvas` 节点打开 Narrative Canvas 编辑器
- [ ] **FLW-05**: Dialogue → Flow 导航 — 在 Narrative Canvas 中点击引用节点跳回 Flow Canvas
- [ ] **FLW-06**: Flow 文件菜单集成 — 右键菜单快捷操作（新建/打开 Flow、跳转到关联 Dialogue）

### Narrative Project

- [ ] **PRJ-01**: 项目配置 UI — 导出路径、格式选项、Godot 项目路径设置
- [ ] **PRJ-02**: 批量导出命令 — 一键导出指定目录下所有 `.ncanvas` 为 `.dialogue`
- [ ] **PRJ-03**: 自动导出（文件变更监听） — 保存 `.ncanvas` 时自动触发导出
- [ ] **PRJ-04**: 导出状态指示 — Obsidian 状态栏显示导出成功/失败/进行中
- [ ] **PRJ-05**: 跨文件引用验证 — 检查 Flow 节点引用的 Dialogue 文件是否存在

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Flow Tools — Advanced

- **FLW-V2-01**: Flow Canvas 节点的视觉自定义（颜色、图标、分组）
- **FLW-V2-02**: Flow 缩略图预览 — 在文件浏览器中显示 Canvas 预览
- **FLW-V2-03**: Flow 节点搜索 — 按名称/类型搜索并跳转到 Flow 中的节点

### Export — Advanced

- **EXP-V2-01**: 导出格式扩展 — 支持 Twee、Yarn Spinner、Ink 等额外格式
- **EXP-V2-02**: 导出预览 — 导出前在 Obsidian 内预览 `.dialogue` 内容
- **EXP-V2-03**: 导出 diff — 显示导出文件与上次导出的差异

### Graph View — Advanced

- **GRP-V2-01**: Graph View 自定义节点样式（按实体类型着色）
- **GRP-V2-02**: Graph View 局部过滤（仅显示当前 Flow 相关节点）
- **GRP-V2-03**: Graph View 跳转 — 从 Graph 节点直接打开对应编辑器

## Out of Scope

| Feature | Reason |
|---------|--------|
| 自定义 Flow 编辑器（替代 Obsidian Canvas） | 设计原则 #1：复用原生能力；维护成本过高 |
| Dialogue 编辑器重写 | Narrative Canvas 已承担，不需要重复造轮子 |
| Narrative Canvas 核心编辑逻辑修改 | 设计原则 #2：减少对 NC 的修改 |
| 数据库或专有格式存储 | 设计原则 #5：所有数据保存在普通文件中 |
| 非 Godot 引擎导出目标 | 约束：仅支持 Godot Dialogue Manager |
| TypeScript 迁移 | 与现有 56K 行 JS 代码库的互操作成本超过收益 |
| 移动端 Obsidian 支持 | 仅桌面端 |
| 游戏内运行时预览 | 完全不同的产品类别，不属于叙事设计工具 |
| 实时多人协作编辑 | 超出 v1 范围，Obsidian 文件级协作（Git）已可用 |
| OAuth / 用户系统 | 本地插件，无服务端 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 | Complete |
| FND-02 | Phase 1 | Complete |
| FND-03 | Phase 1 | Complete |
| FND-04 | Phase 1 | Complete |
| FND-05 | Phase 1 | Complete |
| EXP-01 | Phase 2 | Complete |
| EXP-02 | Phase 2 | Complete |
| EXP-03 | Phase 2 | Complete |
| EXP-04 | Phase 2 | Complete |
| EXP-05 | Phase 2 | Complete |
| EXP-06 | Phase 2 | Complete |
| EXP-07 | Phase 2 | Complete |
| MED-01 | Phase 2 | Pending |
| MED-02 | Phase 2 | Pending |
| MED-03 | Phase 2 | Pending |
| MED-04 | Phase 2 | Pending |
| MED-05 | Phase 2 | Pending |
| MED-06 | Phase 2 | Pending |
| MED-07 | Phase 2 | Pending |
| MED-08 | Phase 2 | Pending |
| ENT-01 | Phase 3 | Pending |
| ENT-02 | Phase 3 | Pending |
| ENT-03 | Phase 3 | Pending |
| ENT-04 | Phase 3 | Pending |
| ENT-05 | Phase 3 | Pending |
| FLW-01 | Phase 3 | Pending |
| FLW-02 | Phase 3 | Pending |
| FLW-03 | Phase 3 | Pending |
| FLW-04 | Phase 3 | Pending |
| FLW-05 | Phase 3 | Pending |
| FLW-06 | Phase 3 | Pending |
| PRJ-01 | Phase 4 | Pending |
| PRJ-02 | Phase 4 | Pending |
| PRJ-03 | Phase 4 | Pending |
| PRJ-04 | Phase 4 | Pending |
| PRJ-05 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 35 total
- Mapped to phases: 35
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-23*
*Last updated: 2026-07-23 after initial definition*
