import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '../embeds/EmbedIDs.json');

export function loadMessageIDs() {
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    return {};
}

export function saveMessageIDs(data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf-8');
}
