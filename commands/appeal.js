import { InteractionContextType, SlashCommandBuilder, ActionRowBuilder, ButtonStyle, ButtonBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
    .setContexts([InteractionContextType.BotDM])
    .setName('appeal')
    .setDescription('This command is only for DMs for users who have been banned, do not use in servers.')
    .addStringOption(option =>
        option.setName('guild_id')
            .setDescription('The ID of the guild you were banned from.')
            .setRequired(true))


export async function execute(interaction) {
    const guildId = interaction.options.getString('guild_id');

    // Create the button
    const appealButton = new ButtonBuilder()
        .setCustomId(`appealButton_${guildId}`) // Embed the guild ID in the custom ID
        .setLabel('Start Ban Appeal')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(appealButton);

    // Reply with a message containing the button
    await interaction.reply({
        content: `To submit your ban appeal for the guild with ID **\`${guildId}\`**, please click the button below.`,
        components: [row]
    });
}
