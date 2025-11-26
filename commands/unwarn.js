import { SlashCommandBuilder, EmbedBuilder, InteractionContextType, PermissionFlagsBits } from "discord.js";
import { getPunishments, editPunishment } from '../Database/databaseAndFunctions.js';
export const data = new SlashCommandBuilder()
    .setName('unwarn')
    .setDescription('removes a users most recent warn')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setContexts(InteractionContextType.Guild)
    .addUserOption(opt =>
        opt.setName('target').setDescription('User to remove warn from').setRequired(true)
    )
export async function execute(interaction) {
    const user = interaction.options.getUser('target')
    let punishments = await getPunishments(user.id, interaction.guild.id, true)
    if (punishments.length < 1)
        return interaction.reply({ embeds: [new EmbedBuilder({ description: `no warns found for ${user}` })] })
    const warns = punishments.filter(warn => warn.type == 'Warn')
    const recentwarn = warns[punishments.length - 1]
    editPunishment({ userId: user.id, guildId: interaction.guild.id, id: recentwarn._id })
    return interaction.reply({ embeds: [new EmbedBuilder({ description: `recent warn removed from ${user}` })] })
}