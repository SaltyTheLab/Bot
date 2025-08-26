import { InteractionContextType, SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
    .setContexts([InteractionContextType.BotDM])
    .setName('appeal')
    .setDescription('This command is only for DMs for users who have been banned, do not use in servers.')
    .addStringOption(option =>
        option.setName('guild_id')
            .setDescription('The ID of the guild you were banned from.')
            .setRequired(true))


export async function execute(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('appealModal')
        .setTitle('Ban Appeal Submission');

    const guildid = new TextInputBuilder()
        .setCustomId('guildId')
        .setLabel("Guild ID")
        .setStyle(TextInputStyle.Short)
        .setValue(interaction.options.getString('guild_id')) // Prefill with the provided ID
        .setRequired(true)

    const reason = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel("Why were you banned?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Put your ban reason here')

    const justification = new TextInputBuilder()
        .setCustomId('justification')
        .setLabel("Why should accept your ban appeal?")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setPlaceholder('Put your explaination here')

    const extra = new TextInputBuilder()
        .setCustomId('extra')
        .setLabel('Anything else we need to know?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setPlaceholder('Put anything else here')

    const firstActionRow = new ActionRowBuilder().addComponents(guildid);
    const secondActionRow = new ActionRowBuilder().addComponents(reason);
    const thirdActionRow = new ActionRowBuilder().addComponents(justification);
    const fourthActionRow = new ActionRowBuilder().addComponents(extra);

    modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow);

    await interaction.showModal(modal);
}



