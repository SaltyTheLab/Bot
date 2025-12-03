import { readFile, writeFile } from 'fs/promises';

export async function load(filepath) {
    return await JSON.parse(await readFile(filepath, 'utf8'));;
}

export async function save(filepath, data) {
    await writeFile(filepath, JSON.stringify(data, null, 2))
}
