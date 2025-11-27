import { load, save } from '../utilities/fileeditors.js';
import { EmbedBuilder, ActionRowBuilder } from 'discord.js';
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
async function sendEmbedAndSave(guildId, messageIDs, embedName, embedData, channel) {
    const oldMessageIndex = messageIDs[guildId].findIndex((message) => message.name === embedName);
    if (oldMessageIndex && oldMessageIndex !== -1)
        messageIDs[guildId].splice(oldMessageIndex, 1);
    const { embeds, components } = embedData;
    const msg = await channel.send({ embeds, components, withResponse: true });
    if (embedData.reactions && embedData.reactions.length > 0)
        for (const reaction of embedData.reactions)
            msg.react(reaction);
    console.log(`📝 Sent '${embedName}' embed. Message ID:`, msg.id);
    if (!messageIDs[guildId])
        messageIDs[guildId] = [];
    messageIDs[guildId].push({ name: embedName, messageId: msg.id, channelid: channel.id });
}
function reconstructComponent(component) {
    if (!component) return null;
    return new ActionRowBuilder(component)
}
function getEmbedData(embedData) {
    const embeds = embedData.embeds.map(embed => {
        if (typeof embed.color === 'string') embed.color = parseInt(embed.color, 16)
        return new EmbedBuilder(embed)
    })
    const components = embedData.components ? embedData.components.map(component => reconstructComponent(component)) : null
    return { embeds: embeds, components: components, reactions: embedData.reactions }
}
export default async function embedsenders(channels) {
    const guildChannelMap = await load("./Extravariables/guildconfiguration.json")
    let embedTasks = [];
    for (const guildId in guildChannelMap) {
        const messageconfigs = guildChannelMap[guildId].messageConfigs;
        if (!messageconfigs) {
            console.log(`No embed configuration found for guild ID: ${guildId}`);
            continue;
        }
        for (const embedName in messageconfigs) {
            const channel = channels.get(messageconfigs[embedName].channelid) ?? null;
            const existingEmbedInfo = messageIDs[guildId]?.find((embed) => embed.name === embedName) ?? null;
            const embedData = getEmbedData(messageconfigs[embedName]);
            embedTasks.push(async () => {
                try {
                    const message = await channel.messages.fetch(existingEmbedInfo.messageId) ?? null;
                    const comparableExistingEmbeds = message.embeds.map(embed => getComparableEmbed(embed.toJSON())).join('|||');
                    const comparableNewEmbeds = embedData.embeds.map(embed => getComparableEmbed(embed.data)).join('|||');
                    if (comparableExistingEmbeds !== comparableNewEmbeds) {
                        message.edit({ embeds: embedData.embeds, ...(embedData.components && { components: embedData.components }) })
                        console.log(`✅ Message '${embedName}' updated successfully.`);
                        return;
                    }
                } catch (err) {
                    console.log(`Failed to fetch/update '${embedName}'. Re-sending. Error: ${err.message}`);
                    await sendEmbedAndSave(guildId, messageIDs, embedName, embedData, channel);
                }
            })
        }
    }
    if (embedTasks.length > 0) {
        await Promise.allSettled(embedTasks.map(task => task()));
        await save('./embeds/embedIDs.json', messageIDs)
    }
}