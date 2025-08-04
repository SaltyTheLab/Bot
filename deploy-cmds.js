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
    const files = await fs.readdir(commandsPath);
    const commandFiles = files.filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        try {
            const filePath = path.join(commandsPath, file);
            const commandModule = await import(pathToFileURL(filePath).href);

            if (commandModule?.data?.name && typeof commandModule.execute === 'function') {
                commands.push(commandModule.data.toJSON());
                console.log(`✅ Loaded: ${commandModule.data.name}`);
            } else {
                console.warn(`⚠️ Skipping invalid command file: ${file}`);
            }
        } catch (err) {
            console.error(`❌ Failed to import ${file}:`, err);
        }
    }

    return commands;
}

// ✅ Main logic
 export default async function register() {
 
        const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;

        if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
            console.error('❌ Missing required environment variables: TOKEN, CLIENT_ID, or GUILD_ID.');
            return;
        }

        const commandsPath = path.join(__dirname, 'commands');
        const commands = await loadCommands(commandsPath);

        if (commands.length === 0) {
            console.warn('⚠️ No valid commands to register.');
            return;
        }

        const rest = new REST({ version: '10' }).setToken(TOKEN);

        try {
            console.log('🔄 Registering slash commands...');
            const data = await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
                { body: commands }
            );
            console.log(`✅ Successfully registered ${data.length} commands.`);
        } catch (err) {
            console.error('❌ Error registering commands with Discord API:', err);
        }
};
