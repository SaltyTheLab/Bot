import embedsenders from "../embeds/embeds.js";
export default {
    data: { name: 'refresh', description: 'Refreshes the Posted embeds', default_member_permission: 1 << 3, contexts: 0 },
    async execute({ interaction, api }) {
        await embedsenders(interaction.guild_id, api);
        await api.interactions.reply(interaction.id, interaction.token, { embeds: [{ description: 'Embeds updated!' }] })
    }
}

