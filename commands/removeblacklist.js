import { EmbedBuilder, SlashCommandBuilder, InteractionContextType, PermissionFlagsBits } from "discord.js";
import { removeblacklist } from "../Database/databasefunctions.js";

export const data = new SlashCommandBuilder()
    .setName('removeblacklist')
    .setContexts(InteractionContextType.Guild)
    .setDescription('Remove a role from a user\'s blacklist')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
        opt.setName('target').setDescription('users blacklist to edit').setRequired(true)
    )
    .addRoleOption(opt =>
        opt.setName('role').setDescription('The role to remove').setRequired(true)
    )

export async function execute(interaction) {
    const target = interaction.options.getUser('target')
    const role = interaction.options.getRole('role')
    const guildId = interaction.guild.id

    removeblacklist(target.id, guildId, role.id)
    const commandembed = new EmbedBuilder()
        .setDescription(`${role} was removed from ${target} blacklist`)

    interaction.reply({ embeds: [commandembed] })
}
