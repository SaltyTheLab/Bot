import { save } from "../utilities/fileeditors.js";
import guildChannelMap from "../Extravariables/guildconfiguration.json" with {type: 'json'}
export default {
    data: {
        name: 'applications',
        description: 'Open/close applications',
        options: [
            { name: 'open', description: 'Open applications', type: 1 },
            { name: 'close', description: 'Close Applications', type: 1 }
        ],
        contexts: 0,
        default_member_permission: 1 << 3,
    },
    async execute({ interaction, api }) {
        const channel = await api.channels.get(guildChannelMap[interaction.guild.id].modChannels.applyChannel)
        if (!BigInt(interaction.member.permissions) & 0x8n === 0x8n)
            return interaction.editReply({ content: `❌ You do not have Channel editing Perms.`, });
        switch (interaction.options[0].name) {
            case 'open':
                await api.channels.edit(channel, { permissionOverwrites: [{ id: interaction.guild_id, type: 0, allow: "2147848672", deny: "0" }] })
                return await api.interactions.editReply(interaction.application_id, interaction.token, { content: 'Apps have now been opened!' });
            case 'close':
                await api.channels.edit(channel, { permissionOverwrites: [{ id: interaction.guild_id, type: 0, allow: "0", deny: "2147848672" }] })
                await save("Extravariables/invites.json", {});
                return await api.interactions.editReply(interaction.application_id, interaction.token, { content: 'Apps have now been closed!' });
        }
    }
}
