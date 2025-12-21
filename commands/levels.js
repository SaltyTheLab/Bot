import { getUser, saveUser } from '../Database/databaseAndFunctions.js';
export default {
    data: {
        name: 'add',
        description: 'add levels/xp to users',
        default_member_permission: 1 << 3,
        options: [
            {
                name: 'xp', description: 'add xp to a user',
                options: [{ name: 'target', description: 'The user', required: true, type: 6 }, { name: 'xp', description: 'amount of xp to give', required: true, type: 4 }]
            },
            {
                name: 'levels', description: 'add levels to a user',
                options: [{ name: 'target', description: 'The user', required: true, type: 6 }, { name: 'level', description: 'Number of levels', required: true, type: 4 }]
            }
        ],
        contexts: 0
    },
    async execute({ interaction, api }) {
        const target = await api.users.get(interaction.data.options[0].options[0].value)
        const embed = { author: { name: interaction.member.user.username, icon_url: `https://cdn.discordapp.com/avatars/${target.id}/${target.avatar}.png` } }
        const { userData } = await getUser({ userId: target.id, guildId: interaction.guild.id, modflag: true })
        let xp = null;
        let level = null;
        switch (interaction.data.options[0].name) {
            case 'xp': {
                xp = interaction.data.options[0].options[1].value; userData.xp += xp; embed.description = `${xp} xp added to <@${target.id}> `; break;
            }
            case 'levels': { level = interaction.data.options[0].options[1].value; userData.level += level; embed.description = `${level} levels added to <@${target.id}>`; break; }
        }
        saveUser({ userId: target.id, guildId: interaction.guild.id, userData: userData });
        await api.interactions.reply(interaction.id, interaction.token, { embeds: [embed] })
    }
}
