import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function load(filepath) {
    const content = await readFile(filepath, 'utf-8').catch(() => '{}');
    if (!content.trim()) return {};
    return await JSON.parse(await readFile(filepath, 'utf8'));;
}

export async function save(filepath, data) {
    await writeFile(filepath, JSON.stringify(data, null, 2))
}
export async function getCommandData(filePaths) {
    const names = new Map();
    for (const filePath of filePaths) {
        const command = await import(pathToFileURL(filePath).href);
        if (command.default.data) names.set(command.default.data.name, command.default.execute)
        else console.warn(`⚠️ Skipping invalid file: ${filePath} (missing 'data' or 'execute' property).`);
    }
    return names;
}
export async function findFiles(dir) {
    const filePaths = [];
    for (const dirent of await readdir(dir, { withFileTypes: true })) if (dirent.isFile() && dirent.name.endsWith('.js')) filePaths.push(join(dir, dirent.name)); else continue;
    return filePaths;
}
