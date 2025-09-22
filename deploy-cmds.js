import { InteractionContextType, REST, Routes } from 'discord.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CLIENT_ID, GUILD_ID, TOKEN } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function findFiles(dir) {
    let filePaths = [];
    try {
        const dirents = await fs.readdir(dir, { withFileTypes: true });
        for (const dirent of dirents) {
            const fullPath = path.join(dir, dirent.name);
            if (dirent.isFile() && dirent.name.endsWith('.js')) {
                filePaths.push(fullPath);
            }
        }
    } catch (error) {
        console.error(`❌ Error reading directory ${dir}:`, error);
    }
    return filePaths;
}
// ✅ Utility: Load all commands
async function loadCommands(commandsPath) {
    const commands = [];
    const filePaths = await findFiles(commandsPath);

    if (filePaths.length === 0) {
        console.warn('⚠️ No command files found.');
        return commands;
    }
    for (const filePath of filePaths) {
        try {
            const commandModule = await import(pathToFileURL(filePath).href);
            const command = commandModule.default || commandModule;

            if (command?.data?.name && typeof command.execute === 'function') {
                // Store the command object, not just the JSON, for context check
                commands.push(command);
            } else {
                console.warn(`⚠️ Skipping invalid command file: ${path.basename(filePath)} (missing 'data' or 'execute' property).`);
            }
        } catch (err) {
            console.error(`❌ Failed to import ${path.basename(filePath)}:`, err);
        }
    }
    return commands;
}

// ✅ Main logic for registering commands
export default async function register() {
    let data;

    if (!TOKEN || !CLIENT_ID) { // GUILD_ID check moved into the loop
        console.error('❌ Missing required environment variables: TOKEN or CLIENT_ID.');
        return;
    }

    const commandsPath = path.join(__dirname, 'commands');
    const loadedCommands = await loadCommands(commandsPath);
    const globalCommandsToRegister = loadedCommands
        .filter(cmd => !cmd.data.contexts.includes(InteractionContextType.PrivateChannel))

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        if (globalCommandsToRegister.length > 0) {
            data = await rest.put(Routes.applicationCommands(CLIENT_ID),
                { body: globalCommandsToRegister.map(cmd => cmd.data.toJSON()) }
            );
            console.log(`✅ Successfully loaded ${data.length} global application (/) commands.`);
        }

    } catch (error) {
        console.error('❌ Error registering global commands with Discord API:', error);
        return;
    }

    if (GUILD_ID) {
        const guildIds = GUILD_ID.split(',').map(id => id.trim()).filter(id => id.length > 0);
        const guildPromises = guildIds.map(async guildId => {
            if (!/^\d+$/.test(guildId)) {
                console.error(`❌ Skipping invalid Guild ID: "${guildId}". It must be a numerical string.`);
                return;
            }
            const guildCommandsPath = path.join(__dirname, 'commands', 'guilds', guildId)
            const guildLoadedCommands = await loadCommands(guildCommandsPath)

            if (guildLoadedCommands.length > 0) {
                try {
                    const guildData = await rest.put(
                        Routes.applicationGuildCommands(CLIENT_ID, guildId),
                        { body: guildLoadedCommands.map(cmd => cmd.data.toJSON()) }
                    );
                    console.log(`✅ Successfully registered ${guildData.length} application (/) commands for guild ${guildId}.`);
                } catch (error) {
                    console.error(`❌ Error registering commands for guild ${guildId} with Discord API:`, error);
                }
            }
        })
        await Promise.all(guildPromises);
    }
};
