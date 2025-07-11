
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
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
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
})

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
    if (welcomeChannel) {
        await welcomeChannel.send({ embeds: [LeaveEmbed] })
    } else {
        console.warn('I can not find my welcome logs.')
    }

})

client.on('messageUpdate', async (message, newMessage) => {
    if (message.author.bot || message.content == newMessage.content) return;
    const editschannelid = '1392990612990595233';
    const logchannel = newMessage.guild.channels.cache.get(editschannelid);
    const messageLink = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;
    const editembed = new EmbedBuilder()
        .setDescription(
            `<@${newMessage.author.id}> edited a message in <#${newMessage.channelId}>

            **Before:**
            ${message.content}  
            **After:**
            ${newMessage.content}   
             

            [Event Link](${messageLink})`
        )
        .setColor(0x309eff)
        .setThumbnail(newMessage.author.displayAvatarURL())
        .setFooter({ text: `ID: ${newMessage.id}` })
        .setTimestamp()
    if (logchannel)
        logchannel.send({ embeds: [editembed] })
})

client.on('messageDelete', async (message) => {
    const deleteschannelid = '1393011824114270238';
    const messageLink = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;
    const logchannel = message.guild.channels.cache.get(deleteschannelid);
    const hasAttachment = message.attachments.size > 0;
    let title = `message by <@${message.author.id}> was deleted in <#${message.channel.id}>`
    if (hasAttachment.size != 0)
        title = `Image and text by <@${message.author.id}> was deleted in <#${message.channel.id}>`
    if (message.partial || !message.author || message.author.bot) return;
    const deletedembed = new EmbedBuilder()
        .setDescription([
            title,

            message.content ? `**Content:**\n${message.content}` : '_No content_',
            hasAttachment ? '\n📎 **An attachment was present' : ''`

            [Event Link](${messageLink})`
        ].join('\n'))
        .setThumbnail(message.author.displayAvatarURL())
        .setFooter({ text: `ID: ${message.id} ` })
        .setTimestamp()

    if (logchannel)
        logchannel.send({ embeds: [deletedembed] })
});
client.login(process.env.TOKEN);