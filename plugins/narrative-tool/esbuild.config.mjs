// esbuild configuration for narrative-tool plugin (merged plugin — D-10/D-11)
// Per RESEARCH.md Pattern 4: esbuild Per-Plugin Configuration
// Verified: esbuild@0.28.1, format 'cjs' is MANDATORY for Obsidian (uses require())
// Single entry point per D-11 (all legacy plugins merged into one main.js).
// external: only 'obsidian' + 'electron' (D-11) — @codemirror/* / @lezer/* dropped.
// loader '.css' (BUG-06): main.js requires('./styles.css') and injects it at runtime.
import * as esbuild from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const isWatch = process.argv.includes('--watch');

const ctx = await esbuild.context({
    entryPoints: ['src/main.js'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    external: ['obsidian', 'electron'],
    outfile: 'main.js',
    sourcemap: isWatch ? 'inline' : false,
    minify: !isWatch,
    treeShaking: true,
    loader: { '.css': 'text' },
    banner: {
        js: `// ${pkg.name} v${pkg.version} - Narrative Toolchain`
    }
});

if (isWatch) {
    await ctx.watch();
    console.log(`[${pkg.name}] watching...`);
} else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log(`[${pkg.name}] build complete -> main.js`);
}
