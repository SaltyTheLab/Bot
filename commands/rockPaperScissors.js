import { EmbedBuilder, SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, InteractionContextType } from "discord.js";
import { getUser, saveUser } from "../Database/databasefunctions.js";

export const data = new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Play rock, paper, scissors')
    .setContexts([InteractionContextType.Guild])

export function execute(interaction) {
    let userWin = false;
    const row = new ActionRowBuilder({
        components: [new ButtonBuilder({
            custom_id: 'Rock',
            label: 'rock',
            style: ButtonStyle.Secondary
        }), new ButtonBuilder({
            custom_id: 'Paper',
            label: 'paper',
            style: ButtonStyle.Secondary
        }), new ButtonBuilder({
            custom_id: 'Scissors',
            label: 'scissors',
            style: ButtonStyle.Secondary
        })]
    })
    interaction.reply({
        embeds: [new EmbedBuilder({
            title: '**Pick your option**',
            color: 0x00a900
        })],
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
        if (userWin) {
            const { userData } = await getUser(interaction.user.id, interaction.guild.id)
            userData.coins += 20;
            await saveUser(interaction.user.id, interaction.guild.id, { userData });
        }
        await i.update({
            embeds: [new EmbedBuilder({
                title: result,
                description: `You chose **${userchoice}**.\nOpponent chose **${opponentchoice}**.`,
                color: 0xffa500
            })],
            components: []
        });
    })
}
