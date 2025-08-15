import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Utility: Load all commands
async function loadCommands(commandsPath) {
    const commands = [];
    let filePaths = [];

    // Helper function to find all .js files recursively
    async function findFiles(dir) {
        try {
            const dirents = await fs.readdir(dir, { withFileTypes: true });
            for (const dirent of dirents) {
                const fullPath = path.join(dir, dirent.name);
                if (dirent.isDirectory()) {
                    await findFiles(fullPath);
                } else if (dirent.isFile() && dirent.name.endsWith('.js')) {
                    filePaths.push(fullPath);
                }
            }
        } catch (error) {
            console.error(`❌ Error reading directory ${dir}:`, error);
        }
    }

    await findFiles(commandsPath);

    if (filePaths.length === 0) {
        console.warn('⚠️ No command files found.');
        return commands;
    }

    for (const filePath of filePaths) {
        try {
            // Correctly format the file path as a URL for dynamic import
            const commandModule = await import(pathToFileURL(filePath).href); 
            
            // Check for both 'default' export and direct properties
            const command = commandModule.default || commandModule;

            if (command?.data?.name && typeof command.execute === 'function') {
                commands.push(command.data.toJSON());
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
    const { TOKEN, CLIENT_ID, GUILD_ID } = process.env; // GUILD_ID is the string here

    if (!TOKEN || !CLIENT_ID) { // GUILD_ID check moved into the loop
        console.error('❌ Missing required environment variables: TOKEN or CLIENT_ID.');
        return;
    }

    const commandsPath = path.join(__dirname, 'commands');
    const commands = await loadCommands(commandsPath);

    if (commands.length === 0) {
        console.warn('⚠️ No valid commands to register.');
        return;
    }

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    // --- NEW LOGIC FOR MULTIPLE GUILDS ---
    if (!GUILD_ID) {
        console.warn('GUILD_ID environment variable is not set. Registering commands globally (may take up to an hour to propagate).');
        try {
            const data = await rest.put(
                Routes.applicationCommands(CLIENT_ID),
                { body: commands },
            );
            console.log(`✅ Successfully loaded ${data.length} global application (/) commands.`);
        } catch (error) {
            console.error('❌ Error registering global commands with Discord API:', error);
        }
        return; // Exit after global registration
    }

    const guildIds = GUILD_ID.split(',').map(id => id.trim());
    //register commands at a per guild basis
    for (const guildId of guildIds) {
        console.log(`🔄 Attempting to register commands for Guild ID: ${guildId}...`);
        try {
            // The put method is used to fully refresh all commands in the guild with the current set
            const data = await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, guildId), // Correctly uses a single guildId
                { body: commands },
            );
            console.log(`✅ Successfully registered ${data.length} application (/) commands for guild ${guildId}.`);
        } catch (error) {
            // Catch and log errors for each guild individually
            console.error(`❌ Error registering commands for guild ${guildId} with Discord API:`, error);
        }
    }
    // --- END NEW LOGIC ---
};