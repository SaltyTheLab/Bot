
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Client, GatewayIntentBits, Collection, EmbedBuilder } from 'discord.js';
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
// add in the list of commands to the bot
client.commands = new Collection();

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = await import(pathToFileURL(filePath).href);
    client.commands.set(command.data.name, command);
}
// universal method for every slash command, making them modular
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

//needed something to prove bot was active
client.on('messageCreate', message => {
    if (message.content == 'dmme') {
        message.author.send('Hey! This is a DM from the bot.')
            .catch(() => message.reply('I coudn\'t DM you-maybe your settings block it.'));
    }
})


client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', message => {
    if (message.content.toLowerCase() == 'cute')
        message.reply('You\'re Cute'
        );
})

client.on('messageCreate', message => {
    if (message.content.toLowerCase() == 'adorable')
        message.reply('You\'re Adorable')
});

client.on('guildMemberAdd', async (member) => {
    const WelcomeEmbed = new EmbedBuilder()
        .setColor(0x00FF99)
        .setDescription(
            `Welcome ${member} to the server!`
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: 'Discord Join Date:', value: `\`${member.joinedAt}\``, inline: true }
        )
    const welcomechannelid = '1392972733704572959';
    const welcomeChannel = member.guild.channels.cache.get(welcomechannelid)
    if (welcomeChannel) {
        await welcomeChannel.send({ embeds: [WelcomeEmbed] })
    } else {
        console.warn('I can not find my welcome logs.')
    }
})

client.on('guildMemberRemove', async (member) => {
    const LeaveEmbed = new EmbedBuilder()
        .setColor(0xa90000)
        .setDescription(
            `${member} has left the cave.`

        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields({ name: 'Joined the cave on:', value: `${member.guild.joinedAt()}`, inline: true })
}
)

client.login(process.env.TOKEN);