import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from 'dotenv';
import { botlisteners } from './botlisteners.js';
var commandcounter = 0;//count commands used

//This sets up the commands to be added to the bot.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const moderationCommmands =["warn", "mute", "ban",];
const counterPath = path.join(__dirname, "Logging", "commandcounter.json");

config();
//bot intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});
// add in the list of commands to the bot
client.commands = new Collection();
//register commands to the bot
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = await import(pathToFileURL(filePath).href);
    client.commands.set(command.data.name, command);
}

// universal method for every slash command, making them modular
client.on('interactionCreate', async interaction => {
    // Only handle slash commands (not context menu, buttons, etc.)
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // Prepare log entry
    const logEntery = {
        command: interaction.commandName,
        user: interaction.user.tag,
        timestamp: new Date().toISOString(),
    };

    try {
        await command.execute(interaction);
        if(moderationCommmands.includes(interaction.commandName.toLowerCase())) {
            let commandcounter = {};
            try{
                counter = JSON.parse(fs.readFileSync(counterPath));

            }   catch (err){
                counter = {};

            }
            counter[IntegrationApplication.commandName] = (counters[interaction.commandName] || 0) + 1;
            fs.writeFileSync(counterPath, JSON.stringify(counters, null, 2));
        }
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Something went wrong.', ephemeral: true });
    }
    // Log command usage (non-blocking)
    fetch('http://localhost:5500/log', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(logEntery)
    }).catch(err => {
        console.error('Failed to log command:', err);
    });
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

botlisteners(client);


client.login(process.env.TOKEN);