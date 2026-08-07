// shared-characters.js -- 加载 vault 共享角色表（SHR-01）
//
// 共享角色存在 vault `Characters/*.md` 的 frontmatter 中，不写入 .ncanvas
// 文件。.ncanvas 节点的 cast 条目可用 `gc-<frontmatter id>` 引用共享角色；
// 导出时把本模块的结果作为 config.externalCharacters 注入 exportEngine，
// 由引擎做兜底解析（project.characters 优先）。
//
// 契约（与 NarrativeCanvas 侧一致，见 10-01-PLAN.md）：
//   - 共享角色 ID = 'gc-' + frontmatter id（无 id 时退化为文件 basename）
//   - name 取 frontmatter name（无则 basename）；role/voice 取同名字段

/**
 * 扫描 vault `<folder>/*.md`，把 frontmatter 解析为共享角色数组。
 *
 * @param {Object} app - Obsidian App 实例（需有 vault.getFiles 和 metadataCache.getFileCache）
 * @param {string} [folder='Characters'] - 共享角色目录；空字符串返回 []
 * @returns {Array<{id: string, name: string, role: *, voice: *}>} 共享角色数组
 */
function loadSharedCharacters(app, folder) {
    const dir = (folder === undefined || folder === null)
        ? 'Characters'
        : String(folder).trim().replace(/\/+$/, '');
    if (!dir) return [];

    const prefix = dir + '/';
    const files = app.vault.getFiles().filter(f =>
        f.extension === 'md' && f.path.startsWith(prefix)
    );

    const characters = [];
    for (const file of files) {
        const frontmatter = app.metadataCache
            && app.metadataCache.getFileCache(file)?.frontmatter;
        // 拿不到 frontmatter 的文件不是共享角色，跳过
        if (!frontmatter) continue;

        const rawId = (frontmatter.id !== undefined && frontmatter.id !== null
            && String(frontmatter.id).trim() !== '')
            ? String(frontmatter.id).trim()
            : file.basename;
        const name = (frontmatter.name !== undefined && frontmatter.name !== null
            && String(frontmatter.name).trim() !== '')
            ? String(frontmatter.name).trim()
            : file.basename;

        characters.push({
            id: 'gc-' + rawId,
            name: name,
            role: frontmatter.role,
            voice: frontmatter.voice
        });
    }
    return characters;
}

module.exports = { loadSharedCharacters };
