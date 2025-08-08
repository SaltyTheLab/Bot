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
    let commandFolders;
    try {
        // Assuming commands are directly in 'commands' folder, or in subfolders
        commandFolders = (await fs.stat(commandsPath)).isDirectory() ? await fs.readdir(commandsPath) : [];
    } catch (error) {
        console.error(`❌ Error reading commands directory ${commandsPath}:`, error);
        return commands;
    }


    for (const folderOrFile of commandFolders) {
        const fullPath = path.join(commandsPath, folderOrFile);
        const stat = await fs.stat(fullPath);

        let filesToProcess = [];
        if (stat.isDirectory()) {
            // If it's a subfolder, read its contents
            filesToProcess = (await fs.readdir(fullPath)).filter(file => file.endsWith('.js'));
        } else if (stat.isFile() && folderOrFile.endsWith('.js')) {
            // If it's a direct .js file in the commands folder
            filesToProcess.push(folderOrFile);
        }

        for (const file of filesToProcess) {
            const filePath = stat.isDirectory() ? path.join(fullPath, file) : fullPath;
            try {
                const commandModule = await import(pathToFileURL(filePath).href);

                if (commandModule?.data?.name && typeof commandModule.execute === 'function') {
                    commands.push(commandModule.data.toJSON());
                    console.log(`✅ Loaded: ${commandModule.data.name}`);
                } else {
                    console.warn(`⚠️ Skipping invalid command file: ${file} (missing 'data' or 'execute' property).`);
                }
            } catch (err) {
                console.error(`❌ Failed to import ${file}:`, err);
            }
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
            console.log(`✅ Successfully reloaded ${data.length} global application (/) commands.`);
        } catch (error) {
            console.error('❌ Error registering global commands with Discord API:', error);
        }
        return; // Exit after global registration
    }

    const guildIds = GUILD_ID.split(',').map(id => id.trim());

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

// Call the register function to start the process
register();
