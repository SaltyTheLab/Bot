import { getUser } from '../Database/databaseAndFunctions.js';
import { generateRankCard } from '../utilities/rankcardgenerator.js';
export default {
    data: {
        name: 'user',
        description: 'check your Rank or Profile',
        contexts: 0,
        options: [
            { name: 'rank', description: 'See your xp and Level', options: [{ name: 'member', description: 'The Member', type: 6 }] },
            { name: 'profile', description: 'See your coins and totalmessages', options: [{ name: 'member', description: 'The Member', type: 6 }] }
        ]
    },
    async execute({ interaction, api }) {
        await api.interactions.defer(interaction.id, interaction.token);
        const subcommand = interaction.data.options[0];
        const memberOption = subcommand.options?.find(opt => opt.name === 'member');
        const targetUserId = memberOption?.value || interaction.member.user.id;
        const targetUser = interaction.data.resolved?.users?.[targetUserId] || interaction.member.user;
        const { userData, rank } = await getUser({ userId: targetUser.id, guildId: interaction.guild_id, modflag: true });
        if (!userData) return api.interactions.editReply(interaction.application_id, interaction.token, { content: 'User data not found or incomplete.', flags: 64 });
        let image;
        switch (subcommand.name) {
            case 'rank': {
                const xpNeeded = Math.round(((userData.level - 1) ** 1.5 * 52 + 40) / 20) * 20
                image = await generateRankCard({ userData: userData, targetUser: targetUser, xpNeeded: xpNeeded, rank: rank })
                break;
            }
            case 'profile':
                image = await generateRankCard({ userData: userData, targetUser: targetUser });
        }
        return await api.interactions.editReply(interaction.application_id, interaction.token, { files: [{ data: image.file, name: image.name }] })
    }
}
