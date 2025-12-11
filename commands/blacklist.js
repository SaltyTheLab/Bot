import { EmbedBuilder, SlashCommandBuilder, InteractionContextType, PermissionFlagsBits } from "discord.js";
import { getblacklist, editblacklist } from '../Database/databaseAndFunctions.js';

export const data = new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('edit/show a users blacklist')
    .addSubcommand(command =>
        command.setName('add').setDescription('add a role to a users blacklist')
            .addUserOption(opt => opt.setName('target').setDescription('The user you want to modify').setRequired(true))
            .addRoleOption(opt => opt.setName('role').setDescription('The role to add').setRequired(true)))
    .addSubcommand(command =>
        command.setName('show').setDescription('get a users black list')
            .addUserOption(opt => opt.setName('target').setDescription('user to show').setRequired(true)))
    .addSubcommand(command =>
        command.setName('remove').setDescription('remove a role from a blacklist')
            .addUserOption(opt => opt.setName('target').setDescription('user you want to modify').setRequired(true))
            .addRoleOption(opt => opt.setName('role').setDescription('the role you want to remove').setRequired(true)))
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)

export async function execute(interaction) {
    const targetUser = interaction.options.getMember('target');
    const blacklist = await getblacklist(targetUser.id, interaction.guild.id)
    const role = interaction.options.getRole('role') ?? null
    const embed = new EmbedBuilder({ description: `${targetUser}'s blacklist\n\nblacklist: ${blacklist.length > 0 ? blacklist.map(role => `<@&${role}>`).join(',') : 'empty'}` })
    switch (interaction.options.getSubcommand()) {
        case 'add':
            embed.setDescription(`${role} was blacklisted from ${targetUser}`)
            if (!blacklist.includes(role.id)) {
                editblacklist(targetUser.id, interaction.guild.id, role.id, 'pull')
                targetUser.roles.remove(role)
            } else
                embed.setDescription(`${role} is already blacklisted from ${targetUser}`)
            break;
        case 'remove':
            editblacklist(targetUser.id, interaction.guild.id, role.id)
            embed.setDescription(`${role} was removed from ${targetUser}'s blacklist`)
            break;
    }
    interaction.reply({ embeds: [embed] })
}