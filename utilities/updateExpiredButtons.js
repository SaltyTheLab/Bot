import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { guildModChannelMap } from "../BotListeners/Extravariables/channelids.js";
export default async function updateExpiredButtons(client, guildIds) {
    const guildIdarray = guildIds.split(',').map(id => id.trim());
    const guildFetchPromises = guildIdarray.map(id => client.guilds.fetch(id));
    const guilds = await Promise.all(guildFetchPromises);

    for (const guild of guilds) {

        const Channels = guildModChannelMap[guild.id];
        const welcomeChannel = await guild.channels.fetch(Channels.welcomeChannel);
        if (!welcomeChannel) {
            console.log(`Welcome Channel not found for ${guild.name} (${guild.id})`);
            return;
        }
        const now = Date.now();
        const fiffteenMinutesAgo = now - 15 * 60 * 1000;
        const messages = await welcomeChannel.messages.fetch({ limit: 50 });

        for (const message of messages.values()) {
            const messageTimestamp = message.createdTimestamp;

            if (messageTimestamp > fiffteenMinutesAgo) {
                const buttonComponent = message.components[0];
                if (buttonComponent && !buttonComponent.disabled) {
                    const updatedBanButton = new ButtonBuilder()
                        .setCustomId(buttonComponent.components[0].customId)
                        .setLabel(buttonComponent.components[0].label === '🔨 Ban User & Delete Invite' ? '🔨 Ban User & Delete Invite (Expired)'
                            : '🔨 Ban (Expired)')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(true)

                    const updatedActionRow = new ActionRowBuilder().addComponents(updatedBanButton);
                    await message.edit({ components: [updatedActionRow] });
                    console.log(`Ban button in message ${message.id} disabled.`);
                }
            }
        }
    }
}