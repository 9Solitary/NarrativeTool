// build.mjs — Root one-step build (ENG-02 / ENG-03, Phase 7; Phase 10 起含 NC)
//
//   npm run build
//
// 1. Runs esbuild for the merged narrative-tool plugin (single step)
// 2. Rebuilds the customized Narrative Canvas bundle + styles (vendored fork)
// 3. Stages deployable artifacts:
//      output/narrative-tool/    — main.js + manifest.json + styles.css
//      output/narrative-canvas/  — main.js + manifest.json + styles.css
//
// Deploy: copy both output/* dirs into <vault>/.obsidian/plugins/

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const pluginDir = join('plugins', 'narrative-tool');
const ncDir = join('NarrativeCanvas');

if (!existsSync(join(pluginDir, 'node_modules', 'esbuild'))) {
    console.error('[build] esbuild not found. Run first:');
    console.error('        npm --prefix plugins/narrative-tool install');
    process.exit(1);
}

// 1. Compile narrative-tool (esbuild, single step)
execFileSync(process.execPath, ['esbuild.config.mjs'], { cwd: pluginDir, stdio: 'inherit' });

// 2. Rebuild the customized Narrative Canvas plugin (bundle + styles)
execFileSync(process.execPath, ['scripts/build-plugin-bundle.cjs'], { cwd: ncDir, stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/build-plugin-styles.cjs'], { cwd: ncDir, stdio: 'inherit' });

// 3. Stage deploy artifacts
for (const [src, out] of [
    [pluginDir, join('output', 'narrative-tool')],
    [ncDir, join('output', 'narrative-canvas')],
]) {
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    copyFileSync(join(src, 'main.js'), join(out, 'main.js'));
    copyFileSync(join(src, 'manifest.json'), join(out, 'manifest.json'));
    // narrative-tool 的运行时样式源在 src/styles.css；NC 的样式产物就在根目录
    const stylesSrc = existsSync(join(src, 'styles.css'))
        ? join(src, 'styles.css')
        : join(src, 'src', 'styles.css');
    copyFileSync(stylesSrc, join(out, 'styles.css'));
    console.log(`[build] deploy artifacts -> ${out}/ (main.js, manifest.json, styles.css)`);
}
