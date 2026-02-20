export { }
const result = await Bun.build({
    entrypoints: ['interactions.ts', 'root.ts'],
    outdir: './dist',
    target: 'bun',
    minify: true,
    sourcemap: 'external',
    tsconfig: './tsconfig.json',
    format: "esm",
    packages: "bundle"
});

if (result.success) {
    console.log("Build successful!");
} else {
    console.error("Build failed", result.logs);
}