import 'dotenv/config';

import { Client, GatewayIntentBits } from 'discord.js';
const client = new Client({
    intents: [GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
    ]
});
client.on('messageCreate', message => {
    if(message.content == 'dmme'){
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