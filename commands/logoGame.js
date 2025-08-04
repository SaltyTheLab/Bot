import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } from "discord.js";
import { getUser, saveUser } from "../Database/databaseFunctions.js";
import fs from 'node:fs';
import path from 'node:path'

// Read and parse logos JSON correctly
const info = fs.readFileSync('./Database/logos.json', 'utf-8');
const logos = JSON.parse(info);

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export const data = new SlashCommandBuilder()
    .setName('logos')
    .setDescription('Guess the logo');

export async function execute(interaction) {
    const user = interaction.user;

    // Pick a random logo as the correct answer
    const logo = logos[Math.floor(Math.random() * logos.length)];
    const imagePath = path.resolve(`./${logo.image}`);
    // Filter out the correct logo and pick up to 3 distractors
    const filtered = logos.filter(l => l.brand !== logo.brand);
    const distractorsCount = Math.min(3, filtered.length);
    const distractors = shuffle(filtered).slice(0, distractorsCount);

    const choices = [logo, ...distractors];
    const options = shuffle(choices);

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
            name: `Guess this logo ${user.tag}`,
            iconURL: user.displayAvatarURL({ dynamic: true }),
        })
        .setColor(0x000085);

    await interaction.reply({
        embeds: [quiry.setImage('attachment://logo.png')],
        files: [{ attachment: imagePath, name: 'logo.png' }],
        components: [buttons]
    });

    const filter = i => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

    collector.on('collect', async i => {
        const updatedButtons = new ActionRowBuilder();

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
            const { userData } = getUser(user.id);
            userData.points += 20;
            saveUser(userData);
        }
        await i.update({
            components: [updatedButtons],
        });

        collector.stop();
    });
}
