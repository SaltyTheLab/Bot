import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, InteractionContextType, ComponentType } from "discord.js";
import { getUser, saveUser } from "../Database/databasefunctions.js";
import { resolve } from 'node:path';
import { load } from "../utilities/fileeditors.js";

function getRandomColor() {
    const randomHex = Math.floor(Math.random() * 16777215)
    return `#${randomHex.toString(16).padStart(6, '0')}`
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export const data = new SlashCommandBuilder()
    .setName('logos')
    .setContexts([InteractionContextType.Guild])
    .setDescription('Guess the logo');

export async function execute(interaction) {
    const logos = await load('Database/logos.json');
    // Pick a random logo as the correct answer
    const logo = logos[Math.floor(Math.random() * logos.length)];
    // Filter out the correct logo and pick 3 distractors
    const noAnswerLogo = logos.filter(l => l.brand !== logo.brand)
    const distractors = shuffle(noAnswerLogo).slice(0, 3);
    const options = shuffle([logo, ...distractors]);

    const buttons = new ActionRowBuilder();
    options.forEach(option => {
        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId(option.brand)
                .setLabel(option.brand)
                .setStyle(ButtonStyle.Primary)
        );
    });

    const quiry = new EmbedBuilder()
        .setAuthor({
            name: `Guess this logo ${interaction.user.tag}`,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
        })
        .setColor(getRandomColor())

    const message = await interaction.reply({
        embeds: [quiry.setImage('attachment://logo.png')],
        files: [
            { attachment: resolve(`./${logo.image}`), name: 'logo.png' }
        ],
        components: [buttons],
        withResponse: true
    },);
    const collector = message.resource.message.createMessageComponentCollector(
        {
            componentType: ComponentType.Button,
            filter: i => i.message.id === message.resource.message.id,
            time: 15000
        }
    );
    let updatedButtons;

    collector.on('collect', async i => {
        updatedButtons = new ActionRowBuilder();

        options.forEach(option => {
            const isCorrect = option.brand === logo.brand;
            const wasClicked = i.customId === option.brand;
            updatedButtons.addComponents(
                new ButtonBuilder()
                    .setCustomId(`disabled_${option.brand}`)
                    .setLabel(option.brand)
                    .setStyle(
                        isCorrect
                            ? ButtonStyle.Success
                            : wasClicked
                                ? ButtonStyle.Danger
                                : ButtonStyle.Secondary
                    )
                    .setDisabled(true)
            );
        });
        if (i.customId === logo.brand) {
            const userData = await getUser(interaction.user.id, interaction.guild.id);
            userData.coins += 20;
            await saveUser(interaction.user.id, interaction.guild.id, { userData });
        }
        await i.update({
            components: [updatedButtons],
        });
        collector.stop();
    });
    collector.on('end', async (collected, reason) => {
        if (collected.size === 0 && reason == 'time') {
            updatedButtons = new ActionRowBuilder()

            options.forEach(option => {
                updatedButtons.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`disabled_${option.brand}`)
                        .setLabel(option.brand)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true)
                )
            })
            await interaction.editReply({ components: [updatedButtons] })
        }
    })
}
