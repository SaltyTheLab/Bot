import fs from 'node:fs';
import path from 'node:path';

const recentCommandsPath = path.join(process.cwd(), 'Logging', 'recentCommandslog.json');
const MAX_COMMANDS = 50; // Optional: limit history size

export function logRecentCommand(commandString) {
    try {
        let recentCommands = [];

        if (fs.existsSync(recentCommandsPath)) {
            const data = fs.readFileSync(recentCommandsPath, 'utf8');
            recentCommands = JSON.parse(data);
            if (!Array.isArray(recentCommands)) recentCommands = [];
        }

        recentCommands.unshift(commandString);
        if (recentCommands.length > MAX_COMMANDS) recentCommands.length = MAX_COMMANDS;

        fs.writeFileSync(recentCommandsPath, JSON.stringify(recentCommands, null, 2));
    } catch (err) {
        console.error('Failed to log recent command:', err);
    }
}
