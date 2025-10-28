import { EmbedBuilder, SlashCommandBuilder, InteractionContextType, PermissionFlagsBits } from "discord.js";
import { getblacklist, editblacklist } from "../Database/databasefunctions.js";

export const data = new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('edit/show a users blacklist')
    .addSubcommand(command =>
        command.setName('add').setDescription('add a role to a users blacklist')
            .addUserOption(opt =>
                opt.setName('target').setDescription('The user you want to modify').setRequired(true)
            ).addRoleOption(opt =>
                opt.setName('role').setDescription('The role to add').setRequired(true)
            )
    )
    .addSubcommand(command =>
        command.setName('show').setDescription('get a users black list')
            .addUserOption(opt =>
                opt.setName('target').setDescription('user to show').setRequired(true)
            )
    )
    .addSubcommand(command =>
        command.setName('remove').setDescription('remove a role from a blacklist')
            .addUserOption(opt =>
                opt.setName('target').setDescription('user you want to modify').setRequired(true)
            )
            .addRoleOption(opt =>
                opt.setName('role').setDescription('the role you want to remove').setRequired(true)
            )
    )
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)

export async function execute(interaction) {
    const command = interaction.options.getSubcommand();
    const targetUser = interaction.options.getMember('target');
    const user = targetUser.user;
    const blacklist = await getblacklist(user.id, interaction.guild.id)
    const list = blacklist.map(role => `<@&${role}>`).join(',')

    switch (command) {
        case 'show': {
            const embed = new EmbedBuilder()
                .setThumbnail(targetUser.user.displayAvatarURL({ dynamic: true }))
                .setDescription(`${targetUser}'s blacklist\n\nblacklist: ${list}`)
            if (list.length == 0)
                embed.setDescription(`${user.tag} blacklist\n\nRoles: empty`)
            interaction.reply({ embeds: [embed] })
            break;
        }
        case 'add': {
            const role = interaction.options.getRole('role')
            const commandembed = new EmbedBuilder().setDescription(`${role} was blacklisted from ${user}`)
            if (!blacklist.includes(role.id)) {
                await editblacklist(user.id, interaction.guild.id, role.id, 'pull')
                await targetUser.roles.remove(role)
            } else
                commandembed.setDescription(`${role} is already blacklisted from ${user}`)
            interaction.reply({ embeds: [commandembed] })
            break;
        }
        case 'remove': {
            const role = interaction.options.getRole('role')
            editblacklist(user.id, interaction.guild.id, role.id)
            const commandembed = new EmbedBuilder()
                .setDescription(`${role} was removed from ${user} blacklist`)
            interaction.reply({ embeds: [commandembed] })
        }
    }
}