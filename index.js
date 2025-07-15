import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from 'dotenv';
import { GuildMemberAdd } from './BotListeners/guildMemberAdd.js';
import { GuildMemberRemove } from './BotListeners/guildMemberRemove.js';
import { GuildMemberUpdate } from './BotListeners/guildMemberUpdate.js';
import { messageUpdate } from './BotListeners/messageUpdate.js';
import { onMessageCreate } from './BotListeners/messageCreate.js';
import { messageDelete } from './BotListeners/messageDelete.js';

// Setup dotenv
config();

// Setup paths for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize client with required intents
export const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Initialize command collection
client.commands = new Collection();

// Load all command modules dynamically
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    try {
        const filePath = path.join(commandsPath, file);
        const command = await import(pathToFileURL(filePath).href);
        if (command?.data?.name && typeof command.execute === 'function') {
            client.commands.set(command.data.name, command);
        } else {
            console.warn(`[WARN] Skipping invalid command module: ${file}`);
        }
    } catch (err) {
        console.error(`[ERROR] Failed to load command: ${file}`, err);
    }
}

// Slash command handler
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`[COMMAND ERROR] ${interaction.commandName}`, error);
        if (!interaction.replied) {
            await interaction.reply({ content: '❌ Something went wrong executing that command.', ephemeral: true });
        } else {
            await interaction.followUp({ content: '❌ An error occurred.', ephemeral: true });
        }
    }
});

// Log when the bot is ready
client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

// Register listeners
client.on('messageCreate', (message) => onMessageCreate(client, message));
client.on('messageDelete', (message) => messageDelete(message));
client.on('guildMemberAdd', (member) => GuildMemberAdd(member, client));
client.on('guildMemberRemove', (member) => GuildMemberRemove(member));
client.on('guildMemberUpdate', GuildMemberUpdate);
client.on('messageUpdate', (message) => messageUpdate(client, message));

// Start the bot
client.login(process.env.TOKEN);
