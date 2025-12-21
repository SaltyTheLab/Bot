import { getblacklist, editblacklist } from '../Database/databaseAndFunctions.js';
export default {
    data: {
        name: 'blacklist',
        description: 'edit/show a users blacklist',
        contexts: 0,
        default_member_permission: 1 << 8,
        options: [
            {
                name: 'add', description: 'add a role ',
                options: [{ name: 'target', description: 'User', required: true, type: 6 }, { name: 'role', description: 'role', required: true, type: 8 }]
            },
            { name: 'show', description: 'show blacklist', options: [{ name: 'target', description: 'user to show', required: true, type: 6 }] },
            {
                name: 'remove', description: 'remove a role',
                options: [{ name: 'target', description: 'User', required: true, type: 6 }, { name: 'role', description: 'Role', required: true, type: 8 }]
            }
        ]
    },
    async execute({ interaction, api }) {
        const targetUser = interaction.data.options[0].options[0].value
        const blacklist = await getblacklist(targetUser, interaction.guild_id)
        let role = null
        const embed = { description: `<@${targetUser}>'s blacklist\n\nblacklist: ${blacklist.length > 0 ? blacklist.map(role => `<@&${role}>`).join(',') : 'empty'}` }
        switch (interaction.data.options[0].name) {
            case 'add':
                role = interaction.data.options[0].options[1].value
                embed.description = `<@&${role}> was blacklisted from <@${targetUser}>`
                if (!blacklist.includes(role.id)) {
                    await editblacklist(targetUser, interaction.guild_id, role, 'push')
                    await api.guilds.removeRoleFromMember(interaction.guild_id, targetUser, role)
                } else embed.description = `<@&${role}> is already blacklisted from <@${targetUser}>`
                break;
            case 'remove':
                role = interaction.data.options[0].options[1].value
                editblacklist(targetUser, interaction.guild_id, role, 'pull')
                embed.description = `<@&${role}> was removed from <@${targetUser}>'s blacklist`
                break;
        }
        await api.interactions.reply(interaction.id, interaction.token, { embeds: [embed] })
    }
}
