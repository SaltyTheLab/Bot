
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();

for (const file of commandFiles) {
    const filePath  = path.join(commandsPath, file);
    const command = await import(pathToFileURL(filePath).href);
    client.commands.set(command.data.name, command);
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'Something went wrong.', ephemeral: true });
  }
});

client.on('messageCreate', message => {
    if (message.content == 'dmme') {
        message.author.send('Hey! This is a DM from the bot.')
            .catch(() => message.reply('I coudn\'t DM you-maybe your settings block it.'));
    }
})

client.once('ready', () => {
    console.log('Logged in as ${client.user.tag}');
});
client.on('messageCreate', message => {
    if (message.content.toLowerCase() == 'ping')
        message.reply('Pong!');
})
client.on('messageCreate', message => {
    if (message.content.toLowerCase() == 'cute')
        message.reply('You\'re Cute'
        );
})

client.login(process.env.TOKEN);