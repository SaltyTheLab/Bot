import { EmbedBuilder, SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
import { getUser, saveUser } from "../Database/databasefunctions.js";

export const data = new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Play rock, paper, scissors')

export function execute(interaction) {
    let userWin = false;
    const user = interaction.user.id;
    const menu = new EmbedBuilder()
        .setTitle(
            '**Pick your option**'
        )
        .setColor(0x00a900)

    const Rock = new ButtonBuilder()
        .setCustomId('Rock')
        .setLabel('rock')
        .setStyle(ButtonStyle.Secondary)
    const Paper = new ButtonBuilder()
        .setCustomId('Paper')
        .setLabel('paper')
        .setStyle(ButtonStyle.Secondary)
    const Scissors = new ButtonBuilder()
        .setCustomId('Scissors')
        .setLabel('scissors')
        .setStyle(ButtonStyle.Secondary)


    const row = new ActionRowBuilder().addComponents(Rock, Paper, Scissors)
    interaction.reply({
        embeds: [menu],
        components: [row]
    });
    const opponentchoices = [
        'Rock', 'Paper', 'Scissors'
    ]

    const filter = i => {
        return i.user.id === interaction.user.id;
    };

    const collector = interaction.channel.createMessageComponentCollector({
        filter,
        time: 15000,
        max: 1
    })
    collector.on('collect', async i => {
        const userchoice = i.customId;
        const opponentchoice = opponentchoices[Math.floor(Math.random() * 3)];
        const beats = {
            Rock: 'Scissors',
            Paper: 'Rock',
            Scissors: 'Paper'
        }
        let result = 'Something went wrong. ';

        if (beats[userchoice] === opponentchoice) {
            result = 'you win!!!';
            userWin = true;
        }
        else if (beats[opponentchoice] === userchoice)
            result = 'Febot Wins!!!';
        else if (userchoice.toLowerCase() === opponentchoice.toLowerCase())
            result = "it's a tie!!";

        const resultEmbed = new EmbedBuilder()
            .setTitle(result)
            .setDescription(`You chose **${userchoice}**.\nOpponent chose **${opponentchoice}**.`)
            .setColor(0xffa500);
        if(userWin){
            const {userData} = getUser(user)
            userData.coins += 20;
            saveUser(userData);
        }
        await i.update({
            embeds: [resultEmbed],
            components: []
        });
    })
}
