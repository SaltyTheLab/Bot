import { promises as fs } from 'node:fs';
import path from 'node:path';

const recentCommandsPath = path.join(process.cwd(), 'Logging', 'recentCommandslog.json');
const MAX_COMMANDS = 50;

export async function logRecentCommand(commandString) {
  try {
    let recentCommands = [];

    // Read and parse the file if it exists
    try {
      const data = await fs.readFile(recentCommandsPath, 'utf8');
      recentCommands = JSON.parse(data);
      if (!Array.isArray(recentCommands)) recentCommands = [];
    } catch (readErr) {
      if (readErr.code !== 'ENOENT') throw readErr; // Ignore if file doesn't exist
    }

    // Modify and trim the list
    recentCommands.unshift(commandString);
    if (recentCommands.length > MAX_COMMANDS) recentCommands.length = MAX_COMMANDS;

    // Write the updated array back
    await fs.writeFile(recentCommandsPath, JSON.stringify(recentCommands, null, 2));
  } catch (err) {
    console.error('Failed to log recent command:', err);
  }
}
