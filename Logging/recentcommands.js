
import fs from 'node:fs';
import path from 'node:path';
const recentCommandsPath = path.join(process.cwd(), 'Logging\\recentCommandslog.json');
export function logRecentCommand(commandString) {

    let recentCommands = [];
    try {
        if (fs.existsSync(recentCommandsPath)) {
            recentCommands = JSON.parse(fs.readFileSync(recentCommandsPath, 'utf8'));
        }
    } catch (err) {
        recentCommands = [];
    }
    recentCommands.unshift(commandString);
    if (recentCommands.length > 5) recentCommands = recentCommands.slice(0, 5);
    fs.writeFileSync(recentCommandsPath, JSON.stringify(recentCommands, null, 2));
}