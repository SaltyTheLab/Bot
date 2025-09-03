import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import punishUser from "../utilities/punishUser.js";

export const data = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setContexts([InteractionContextType.Guild])
    .addUserOption(opt =>
        opt.setName('target')
            .setDescription('User to ban')
            .setRequired(true)
    )
    .addStringOption(opt =>
        opt.setName('reason')
            .setDescription('Reason for the ban')
            .setRequired(true)
    );

export async function execute(interaction) {
    const target = await interaction.options.get('target');
    const reason = interaction.options.getString('reason');
    if (!target) {
        return interaction.reply({ content: '⚠️ User not found.', ephemeral: true });
    }

    if (target.bot)
        return interaction.reply({ content: 'You cannot ban a bot.', ephemeral: true });

    await punishUser({
        interaction: interaction,
        guild: interaction.guild,
        target: target.value,
        moderatorUser: interaction.user,
        reason: reason,
        channel: interaction.channel,
        isAutomated: false,
        currentWarnWeight: 1,
        duration: 0,
        unit: 'min',
        banflag: true,
        buttonflag: false
    });

}