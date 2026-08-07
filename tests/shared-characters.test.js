// shared-characters.test.js -- 共享角色表（SHR-01）单元测试
//
// 覆盖两部分：
//   1. commands/shared-characters.js 的 loadSharedCharacters loader 行为
//      （gc- 前缀、id/name 退化、无 frontmatter 跳过、空目录返回 []）
//   2. export-engine.js 的 config.externalCharacters 注入
//      （gc- cast 解析、project.characters 优先、knownCharacterNames 防双前缀、
//        不传 externalCharacters 时行为不变）
//
// 10-01 Workstream B，契约见 .planning/phases/10-shared-characters/10-01-PLAN.md

const { describe, it } = require('node:test');
const assert = require('node:assert');

const { loadSharedCharacters } = require('../plugins/narrative-tool/src/commands/shared-characters');
const { exportEngine } = require('../plugins/narrative-tool/src/engine/export-engine');

// ---------------------------------------------------------------------------
// Mock App：vault.getFiles + metadataCache.getFileCache
// files: [{ path, frontmatter }] — frontmatter 为 null 表示 getFileCache 拿不到
// ---------------------------------------------------------------------------

function createMockApp(files) {
    const vaultFiles = files.map(f => {
        const name = f.path.split('/').pop();
        return {
            path: f.path,
            name: name,
            basename: name.replace(/\.[^.]+$/, ''),
            extension: name.split('.').pop()
        };
    });
    const frontmatterByPath = new Map(files.map(f => [f.path, f.frontmatter]));
    return {
        vault: {
            getFiles: () => vaultFiles
        },
        metadataCache: {
            getFileCache(file) {
                const fm = frontmatterByPath.get(file.path);
                return fm ? { frontmatter: fm } : null;
            }
        }
    };
}

// ===========================================================================
// Test Suite: loadSharedCharacters
// ===========================================================================

describe('loadSharedCharacters', () => {

    it('parses frontmatter into gc- prefixed shared characters', () => {
        const app = createMockApp([
            { path: 'Characters/wyc.md', frontmatter: { id: 'wangyuchang', name: '王裕昌', role: '主角', voice: 'male_low' } }
        ]);
        const result = loadSharedCharacters(app);
        assert.deepStrictEqual(result, [
            { id: 'gc-wangyuchang', name: '王裕昌', role: '主角', voice: 'male_low' }
        ]);
    });

    it('falls back to file basename when frontmatter has no id / no name', () => {
        const app = createMockApp([
            { path: 'Characters/李婶.md', frontmatter: { role: '配角' } },
            { path: 'Characters/zhao.md', frontmatter: { name: '赵四' } }
        ]);
        const result = loadSharedCharacters(app);
        assert.strictEqual(result.length, 2);
        // 无 id 也无 name → 都用 basename
        assert.deepStrictEqual(result[0], { id: 'gc-李婶', name: '李婶', role: '配角', voice: undefined });
        // 有 name 无 id → id 用 basename
        assert.deepStrictEqual(result[1], { id: 'gc-zhao', name: '赵四', role: undefined, voice: undefined });
    });

    it('skips files whose frontmatter cannot be resolved', () => {
        const app = createMockApp([
            { path: 'Characters/plain.md', frontmatter: null },
            { path: 'Characters/wyc.md', frontmatter: { id: 'wyc', name: '王裕昌' } }
        ]);
        const result = loadSharedCharacters(app);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].id, 'gc-wyc');
    });

    it('returns [] for an empty folder', () => {
        const app = createMockApp([]);
        assert.deepStrictEqual(loadSharedCharacters(app), []);
    });

    it('returns [] when folder is an empty string (disabled)', () => {
        const app = createMockApp([
            { path: 'Characters/wyc.md', frontmatter: { id: 'wyc', name: '王裕昌' } }
        ]);
        assert.deepStrictEqual(loadSharedCharacters(app, ''), []);
    });

    it('ignores non-md files and files outside the folder', () => {
        const app = createMockApp([
            { path: 'Characters/wyc.md', frontmatter: { id: 'wyc', name: '王裕昌' } },
            { path: 'Characters/notes.txt', frontmatter: { id: 'x', name: 'X' } },
            { path: 'Other/ls.md', frontmatter: { id: 'ls', name: '李婶' } }
        ]);
        const result = loadSharedCharacters(app);
        assert.deepStrictEqual(result.map(c => c.id), ['gc-wyc']);
    });

    it('honors a custom folder argument', () => {
        const app = createMockApp([
            { path: 'NPCs/wyc.md', frontmatter: { id: 'wyc', name: '王裕昌' } },
            { path: 'Characters/ls.md', frontmatter: { id: 'ls', name: '李婶' } }
        ]);
        const result = loadSharedCharacters(app, 'NPCs');
        assert.deepStrictEqual(result.map(c => c.id), ['gc-wyc']);
    });
});

// ===========================================================================
// Test Suite: exportEngine externalCharacters injection
// ===========================================================================

function makeNcanvas(dialogNode, characters) {
    return {
        project: {
            title: 'Test',
            nodes: [
                { id: 'start', type: 'Entry', title: 'Start', x: 0, y: 0, width: 300, height: 150 },
                dialogNode
            ],
            links: [{ id: 'l1', from: 'start', to: dialogNode.id }],
            characters: characters || [],
            variables: {}
        }
    };
}

describe('exportEngine externalCharacters (SHR-01)', () => {

    it('resolves a cast gc- reference via injected externalCharacters', () => {
        const node = {
            id: 'd1', type: 'Dialog', title: '某对话', body: '你好。',
            cast: [{ characterId: 'gc-wyc', role: 'Speaker' }]
        };
        const output = exportEngine(makeNcanvas(node), {
            medEnabled: false,
            externalCharacters: [{ id: 'gc-wyc', name: '王裕昌' }]
        });
        assert.ok(output.includes('王裕昌: 你好。'),
            'should resolve gc-wyc to 王裕昌, got:\n' + output);
        assert.ok(!output.includes('某对话: 你好。'),
            'should not fall back to node.title');
    });

    it('project.characters wins over externalCharacters on id collision', () => {
        const node = {
            id: 'd1', type: 'Dialog', title: '某对话', body: '你好。',
            cast: [{ characterId: 'gc-wyc', role: 'Speaker' }]
        };
        const output = exportEngine(
            makeNcanvas(node, [{ id: 'gc-wyc', name: '本地裕昌' }]),
            {
                medEnabled: false,
                externalCharacters: [{ id: 'gc-wyc', name: '共享裕昌' }]
            }
        );
        assert.ok(output.includes('本地裕昌: 你好。'),
            'project.characters should win, got:\n' + output);
        assert.ok(!output.includes('共享裕昌'), 'external name should not appear');
    });

    it('shared character name enters knownCharacterNames — no double prefix', () => {
        // cast 指向共享角色，正文已带共享角色名前缀
        const node = {
            id: 'd1', type: 'Dialog', title: '某对话', body: '王裕昌: 进来吧。',
            cast: [{ characterId: 'gc-wyc', role: 'Speaker' }]
        };
        const output = exportEngine(makeNcanvas(node), {
            medEnabled: false,
            externalCharacters: [{ id: 'gc-wyc', name: '王裕昌' }]
        });
        assert.ok(output.includes('王裕昌: 进来吧。'), 'got:\n' + output);
        assert.ok(!output.includes('王裕昌: 王裕昌'),
            'must not re-introduce the C1 double-prefix bug, got:\n' + output);
    });

    it('shared character name is recognized as speaker inside another character\'s body', () => {
        // 李四 的对话正文里混了一行共享角色王裕昌的台词；王裕昌不在
        // project.characters 中，只有 knownCharacterNames 并入外部角色名
        // 才能识别该前缀，避免被错误加上 "李四: " 前缀。
        const node = {
            id: 'd1', type: 'Dialog', title: '李四',
            body: '你来了。\n王裕昌: 嗯，我来了。',
            cast: [{ characterId: 'c-lisi', role: 'Speaker' }]
        };
        const output = exportEngine(
            makeNcanvas(node, [{ id: 'c-lisi', name: '李四' }]),
            {
                medEnabled: false,
                externalCharacters: [{ id: 'gc-wyc', name: '王裕昌' }]
            }
        );
        assert.ok(output.includes('王裕昌: 嗯，我来了。'),
            'shared speaker line should be kept as-is, got:\n' + output);
        assert.ok(!output.includes('李四: 王裕昌'),
            'shared speaker line must not get the node speaker prefix, got:\n' + output);
    });

    it('without externalCharacters, unresolved gc- cast falls back to node.title (unchanged behavior)', () => {
        const node = {
            id: 'd1', type: 'Dialog', title: '某对话', body: '你好。',
            cast: [{ characterId: 'gc-wyc', role: 'Speaker' }]
        };
        const output = exportEngine(makeNcanvas(node), { medEnabled: false });
        assert.ok(output.includes('某对话: 你好。'),
            'should fall back to node.title exactly as before, got:\n' + output);
    });
});
