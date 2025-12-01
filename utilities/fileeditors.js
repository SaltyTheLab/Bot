import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'node:path';

export async function load(filepath) {
    return await JSON.parse(await readFile(filepath, 'utf8'));;
}

export async function save(filepath, data) {
    await writeFile(filepath, JSON.stringify(data, null, 2))
}

export async function findFiles(dir) {
    const filePaths = [];
    try {
        for (const dirent of await readdir(dir, { withFileTypes: true }))
            if (dirent.isFile() && dirent.name.endsWith('.js'))
                filePaths.push(join(dir, dirent.name));
            else continue;
    } catch {/* empty */ }
    return filePaths;
}