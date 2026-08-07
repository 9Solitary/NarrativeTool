// build.mjs — Root one-step build (ENG-02 / ENG-03, Phase 7)
//
//   npm run build
//
// 1. Runs esbuild for the merged narrative-tool plugin (single step)
// 2. Stages deployable artifacts into output/narrative-tool/:
//      main.js        — esbuild bundle
//      manifest.json  — plugin manifest
//      styles.css     — copied from src/styles.css (also injected at runtime;
//                       shipping the file lets Obsidian load styles natively)
//
// Deploy: copy output/narrative-tool/ into <vault>/.obsidian/plugins/

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const pluginDir = join('plugins', 'narrative-tool');
const outDir = join('output', 'narrative-tool');

if (!existsSync(join(pluginDir, 'node_modules', 'esbuild'))) {
    console.error('[build] esbuild not found. Run first:');
    console.error('        npm --prefix plugins/narrative-tool install');
    process.exit(1);
}

// 1. Compile the plugin (esbuild, single step)
execFileSync(process.execPath, ['esbuild.config.mjs'], { cwd: pluginDir, stdio: 'inherit' });

// 2. Stage deploy artifacts
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
copyFileSync(join(pluginDir, 'main.js'), join(outDir, 'main.js'));
copyFileSync(join(pluginDir, 'manifest.json'), join(outDir, 'manifest.json'));
copyFileSync(join(pluginDir, 'src', 'styles.css'), join(outDir, 'styles.css'));

console.log('[build] deploy artifacts -> output/narrative-tool/ (main.js, manifest.json, styles.css)');
