import { load, save } from '../utilities/fileeditors.js';
export default async function logRecentCommand(commandString) {
  const recentCommandsPath = `${process.cwd()}/WebsiteTool/recentCommandslog.json`;
  const MAX_COMMANDS = 50;
  const recentCommands = await load(recentCommandsPath);
  recentCommands.unshift(commandString);
  if (recentCommands.length > MAX_COMMANDS) recentCommands.length = MAX_COMMANDS;
  await save(recentCommandsPath, recentCommands);
}
