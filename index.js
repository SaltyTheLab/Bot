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
import { messageReactionAdd, messageReactionRemove } from './BotListeners/reactionRoles.js';
import { embedsenders } from './embeds/embeds.js';
import { getrolesid } from './BotListeners/channelids.js';



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
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: ['MESSAGE', 'CHANNEL', 'REACTION', 'GUILD_MEMBER', 'USER']
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

// Register listeners
client.on('messageCreate', (message) => onMessageCreate(client, message));
client.on('messageDelete', messageDelete);
client.on('guildMemberAdd', (member) => GuildMemberAdd(member, client));
client.on('guildMemberRemove', GuildMemberRemove);
client.on('guildMemberUpdate', GuildMemberUpdate);
client.on('messageUpdate', messageUpdate);
client.on('messageReactionAdd', messageReactionAdd);
client.on('messageReactionRemove', messageReactionRemove);

//cache the already posted embeds
client.once('ready', async () => {
    const interactiveMessages = [
        { channelId: getrolesid, messageId: "1395238443444862976" },
        { channelId: getrolesid, messageId: "1395238444665540673" },
        { channelId: getrolesid, messageId: "1395238446213234829" },
        { channelId: getrolesid, messageId: "1395238447181992070" },
        { channelId: getrolesid, messageId: "1395238495647174797" },
        { channelId: getrolesid, messageId: "1395238496616190144" }
    ];

    for (const { channelId, messageId } of interactiveMessages) {
        try {
            const channel = await client.channels.fetch(channelId);
            if (!channel?.isTextBased()) {
                console.warn(`⚠️ Channel ${channelId} is not text-based, skipping.`);
                continue;
            }

            const message = await channel.messages.fetch(messageId);
            console.log(`✅ Cached message ${message.id} from channel ${channelId}`);
        } catch (err) {
            console.error(`❌ Failed to fetch message ${messageId} in channel ${channelId}`, err);
        }
    }
    console.log(`✅ Logged in as ${client.user.tag}`);
});
// Start the bot
client.login(process.env.TOKEN);
embedsenders(client);


