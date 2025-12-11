import { load, save } from '../utilities/fileeditors.js';
import { EmbedBuilder } from 'discord.js';
let messageIDs = await load('./embeds/embedIDs.json');
function getComparableEmbed(embedData) {
    if (!embedData) return null;
    const normalizeText = (text) => text ? text.replace(/\r\n/g, '\n').trim() : null;
    const cleanEmbed = {
        title: normalizeText(embedData.title),
        description: normalizeText(embedData.description),
        url: normalizeText(embedData.url),
        color: embedData.color || null,
        fields: embedData.fields ?
            embedData.fields.map(field => ({
                name: normalizeText(field.name),
                value: normalizeText(field.value),
                inline: field.inline || false
            })) : [],
        author: embedData.author ? { name: normalizeText(embedData.author.name) } : null,
        footer: embedData.footer ? { text: normalizeText(embedData.footer.text) } : null
    };
    return JSON.stringify(cleanEmbed);
}
export default async function embedsenders(channels) {
    const guildChannelMap = await load("./Extravariables/guildconfiguration.json")
    let embedTasks = [];
    for (const guildId in guildChannelMap) {
        const messageconfigs = guildChannelMap[guildId].messageConfigs;
        if (!messageconfigs) { console.log(`No config found for guild ID: ${guildId}`); continue; }
        for (const embedName in messageconfigs) {
            const data = messageconfigs[embedName];
            const channel = channels.get(data.channelid) ?? null;
            const embeds = data.embeds.map(embed => { typeof embed.color === 'string' ? embed.color = parseInt(embed.color, 16) : null; return new EmbedBuilder(embed); })
            const components = data.components ?? null
            const reactions = data.reactions
            embedTasks.push(async () => {
                try {
                    const message = await channel.messages.fetch(messageIDs[guildId]?.find((embed) => embed.name === embedName).messageId);
                    const comparableExistingEmbeds = message.embeds.map(embed => getComparableEmbed(embed.toJSON())).join('|||');
                    const comparableNewEmbeds = embeds.map(embed => getComparableEmbed(embed.data)).join('|||');
                    if (comparableExistingEmbeds !== comparableNewEmbeds) {
                        message.edit({ embeds: embeds, ...(components) }); console.log(`✅ Message '${embedName}' updated.`);
                    }
                } catch {
                    const oldMessageIndex = messageIDs[guildId].findIndex((message) => message.name === embedName);
                    if (oldMessageIndex && oldMessageIndex !== -1) messageIDs[guildId].splice(oldMessageIndex, 1);
                    const msg = await channel.send({ embeds, components, withResponse: true });
                    if (reactions && reactions.length > 0) for (const reaction of reactions) msg.react(reaction);
                    console.log(`📝 Sent '${embedName}'. Message ID:`, msg.id);
                    if (!messageIDs[guildId]) messageIDs[guildId] = [];
                    messageIDs[guildId].push({ name: embedName, messageId: msg.id, channelid: channel.id });
                }
            })
        }
    }
    if (embedTasks.length > 0) { await Promise.allSettled(embedTasks.map(task => task())); await save('./embeds/embedIDs.json', messageIDs); }
}