import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';


config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    console.log(`[DEBUG] Found command files:`, commandFiles);

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        console.log(`[DEBUG] Importing command file: ${filePath}`);
        const command = await import(pathToFileURL(filePath).href);
        if ('data' in command && 'execute' in command) {
            console.log(`[DEBUG] Loaded command: ${command.data.name}`);
            commands.push(command.data.toJSON());
        } else {
            console.warn(`[WARNING] ${file} is missing "data" or "execute"`);
        }
    }

    console.log(`[DEBUG] Final commands array:`, commands.map(cmd => cmd.name));

    if (!process.env.TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) {
        return console.log('You need to define TOKEN, CLIENT_ID, and GUILD_ID in your environment variables.');
    }

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        console.log('Registering slash commands...');
        const result = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('[DEBUG] Discord API response:', result);
        console.log('Slash commands registered!');
    } catch (error) {
        console.error('[ERROR] Failed to register slash commands:', error);
    }
})();