Bun.build({ entrypoints: ['./Src/interactions.ts'], packages: 'bundle', compile: { outfile: 'interactions', target: 'bun-windows-x64-modern' }, target: 'bun', minify: true, tsconfig: './tsconfig.json', throw: true, env: "inline", sourcemap: "linked" });

Bun.build({ entrypoints: ['./Src/root.ts'], packages: 'bundle', compile: { outfile: 'root', target: 'bun-windows-x64-modern' }, target: 'bun', minify: true, tsconfig: './tsconfig.json', throw: true, env: "inline", sourcemap: "linked" });

Bun.build({ entrypoints: ['./Src/index.html'], target: 'browser', compile: true, outdir: '.dist', minify: true, throw: true, tsconfig: './tsconfig.json', sourcemap: "linked" });