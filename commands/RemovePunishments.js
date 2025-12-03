import { SlashCommandBuilder, EmbedBuilder, InteractionContextType, PermissionFlagsBits } from "discord.js";
import { getPunishments, editPunishment } from '../Database/databaseAndFunctions.js';
export const data = new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Removes a warn/unmutes a user')
    .addSubcommand(command => command.setName('warn').setDescription('Removes a user\'s recent warn')
        .addUserOption(opt => opt.setName('target').setDescription('User to remove warn from').setRequired(true))
    )
    .addSubcommand(command => command.setName('mute').setDescription('Unmutes a user')
        .addUserOption(opt => opt.setName('target').setDescription('The user to unmute').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setContexts(InteractionContextType.Guild)

export async function execute(interaction) {
    const user = interaction.options.getUser('target')
    switch (interaction.options.getSubcommand()) {
        case 'warn': {
            let punishments = await getPunishments(user.id, interaction.guild.id, true)
            if (punishments.length < 1)
                return interaction.reply({ embeds: [new EmbedBuilder({ description: `no warns found for ${user}` })] })
            const warns = punishments.filter(warn => warn.type == 'Warn')
            const recentwarn = warns[punishments.length - 1]
            editPunishment({ userId: user.id, guildId: interaction.guild.id, id: recentwarn._id })
            return interaction.reply({ embeds: [new EmbedBuilder({ description: `recent warn removed from ${user}` })] })
        }
        case 'mute': {
            const member = await interaction.guild.members.fetch(user.id);
            const embed = new EmbedBuilder({ color: 0xb50000, description: `${user} is not muted.` })
            if (member.communicationDisabledUntil) {
                await member.timeout(null)
                embed.setColor(0x00a900).setDescription(`${user.tag} was unmuted.`)
            }
            return interaction.reply({ embeds: [embed] })
        }
    }
}