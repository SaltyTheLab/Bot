import { EmbedBuilder, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { addblacklist, getblacklist } from "../Database/databasefunctions.js";

export const data = new SlashCommandBuilder()
    .setName('addblacklist')
    .setDescription('add a role to a users blacklist')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
        opt.setName('target').setDescription('user to add to').setRequired(true)
    )
    .addRoleOption(opt =>
        opt.setName('role').setDescription('role to blacklist').setRequired(true)
    )

export async function execute(interaction) {
    const targetUser = interaction.options.getMember('target')
    const guildId = interaction.guild.id;
    const role = interaction.options.getRole('role');
    const currentlist = await getblacklist(targetUser.id, guildId)
    const commandembed = new EmbedBuilder().setDescription(`${role} was blacklisted from ${targetUser}`)
    if (!currentlist.includes(role.id)) {
        await addblacklist(targetUser.id, guildId, role.id)
        await targetUser.roles.remove(role)
    } else
        commandembed.setDescription(`${role} is already blacklisted from ${targetUser}`)
    interaction.reply({ embeds: [commandembed] })
}