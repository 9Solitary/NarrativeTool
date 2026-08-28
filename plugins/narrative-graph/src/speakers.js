// speakers.js — vault 共享角色读取（Phase 11 M2b, NG-07）
//
// 与 narrative-tool 的 shared-characters.js 同一约定（互不依赖、各自实现）：
// 共享角色存在 vault `Characters/*.md` 的 frontmatter 中，不写入 .ncanvas；
//   - 角色 ID = 'gc-' + frontmatter id（无 id 时退化为文件 basename）
//   - name 取 frontmatter name（无则 basename）；role/voice 透传
//
// listSpeakersFromFiles 是纯函数（便于测试）；loadSpeakers 是对
// vault/metadataCache API 的薄包装，守卫 API 缺失并静默退化为 []——
// 说话人补全只是便利功能，角色表读不到时自由文本输入依然合法。

/**
 * 把文件列表 + frontmatter 查询解析为共享角色数组（纯函数）。
 *
 * @param {Array<{path: string, basename: string, extension: string}>} files
 * @param {(file: Object) => (Object|undefined)} getFrontmatter
 * @param {string} [folder='Characters'] - 共享角色目录；空字符串返回 []
 * @returns {Array<{id: string, name: string, role: *, voice: *}>}
 */
function listSpeakersFromFiles(files, getFrontmatter, folder) {
    const dir = (folder === undefined || folder === null)
        ? 'Characters'
        : String(folder).trim().replace(/\/+$/, '');
    if (!dir) return [];

    const prefix = dir + '/';
    const speakers = [];
    for (const file of files || []) {
        if (!file || file.extension !== 'md' || !file.path.startsWith(prefix)) continue;
        const frontmatter = getFrontmatter(file);
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

        speakers.push({
            id: 'gc-' + rawId,
            name: name,
            role: frontmatter.role,
            voice: frontmatter.voice
        });
    }
    return speakers;
}

/**
 * 从 vault 加载共享角色（薄包装；任何一步失败都返回 []）。
 *
 * @param {Object} app - Obsidian App 实例（需有 vault.getFiles 和
 *   metadataCache.getFileCache；缺失时返回 []）
 * @param {string} [folder='Characters']
 * @returns {Array<{id: string, name: string, role: *, voice: *}>}
 */
function loadSpeakers(app, folder) {
    try {
        const vault = app && app.vault;
        const cache = app && app.metadataCache;
        if (!vault || typeof vault.getFiles !== 'function'
            || !cache || typeof cache.getFileCache !== 'function') return [];
        return listSpeakersFromFiles(
            vault.getFiles(),
            (file) => {
                const entry = cache.getFileCache(file);
                return entry && entry.frontmatter;
            },
            folder
        );
    } catch (_err) {
        return [];
    }
}

module.exports = { listSpeakersFromFiles, loadSpeakers };
