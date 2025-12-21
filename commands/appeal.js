import { appealsget } from '../Database/databaseAndFunctions.js';
export default {
    data: { name: 'Appeal', description: 'appeal a ban', contexts: 1 },
    async execute({ interaction, api }) {
        const userbans = await appealsget(interaction.member.user.id)
        const options = []
        userbans.forEach(ban => {
            const banentry = ban.punishments.filter(p => p.type === 'Ban') ?? null
            const guild = interaction.client.guilds.cache.get(ban.guildId);
            if (banentry.length !== 0) {
                options.push({ label: guild.name, value: guild.id, description: `Banned on: ${new Date(ban.punishments.timestamp).toLocaleDateString()}` });
            }
        })
        if (options.length == 0) return await api.interactions.reply(interaction.id, interaction.token, { content: 'I could not find any ban records for any servers i am in.' })
        await api.interactions.createModal(interaction.id, interaction.token, {
            custom_id: 'appealModal',
            title: 'Ban Appeal Submission',
            components: [
                { type: 18, label: "Guild ID", component: { type: 3, custom_id: 'guildId', max_values: 1, options: options } },
                { type: 18, label: "Why were you banned?", component: { type: 4, custom_id: 'reason', style: 2, required: true } },
                { type: 18, label: "Why should we accept your appeal?", component: { type: 4, custom_id: 'justification', style: 2, required: true } },
                { type: 18, label: 'Anything else we need to know?', component: { type: 4, custom_id: 'extra', style: 2, required: false } }]
        });
    }
}
