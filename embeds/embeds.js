import { EmbedBuilder } from 'discord.js';
import guildChannelMap from "../Extravariables/guildconfiguration.json" with {type: 'json'};
import { load, save } from '../utilities/fileeditors.js';
import { guildEmbedConfig } from './embedData.js';
let messageIDs = await load('./embeds/embedIDs.json');
function getComparableEmbed(embedData) {
    if (!embedData) return null;
    const normalizeText = (text) => text?.replace(/\r\n/g, '\n').trim() || null;
    const cleanEmbed = {
        title: normalizeText(embedData.title) || null,
        description: normalizeText(embedData.description) || null,
        url: normalizeText(embedData.url) || null,
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
async function sendEmbedAndSave(guildId, channels, messageIDs, embedName, embedData, guildChannels) {
    const channel = channels.get(guildChannels[embedName]);
    const oldMessageIndex = messageIDs[guildId].findIndex((message) => message.name === embedName) ?? null;
    if (oldMessageIndex && oldMessageIndex !== -1)
        messageIDs[guildId].splice(oldMessageIndex, 1);
    const { embeds, components } = embedData;
    const msg = await channel.send({ embeds, components, withResponse: true });
    if (embedData.reactions && embedData.reactions.length > 0) {
        for (const reaction of embedData.reactions) {
            try {
                await msg.react(reaction);
            } catch (error) {
                console.error(`Failed to react with ${reaction}:`, error);
            }
        }
    }
    console.log(`📝 Sent '${embedName}' embed. Message ID:`, msg.id);
    if (!messageIDs[guildId])
        messageIDs[guildId] = [];
    messageIDs[guildId].push({
        name: embedName,
        messageId: msg.id,
        channelid: channel.id,
    });
}
function generateEmbedData(configData) {
    const embed = new EmbedBuilder(configData.embeds)
    const reactions = configData.reactions || null
    const components = configData.components || null
    return {
        embeds: [embed],
        components: components,
        reactions: reactions
    }
}
export default async function embedsenders(guildIds, channels) {
    let embedTasks = [];
    for (const guildId of guildIds) {
        const guildConfig = guildEmbedConfig[guildId];
        if (!guildConfig) {
            console.log(`No embed configuration found for guild ID: ${guildId}`);
            continue;
        }
        const guildChannels = guildChannelMap[guildId].publicChannels;
        if (!guildChannels) {
            console.error(`❌ No channel mapping found for guild ID: ${guildId}. Please check guildChannelMap.`);
            continue;
        }
        for (const embedName in guildConfig) {
            const existingEmbedInfo = messageIDs[guildId]?.find((embed) => embed.name === embedName) ?? null;
            embedTasks.push(async () => {
                const embedData = generateEmbedData(guildConfig[embedName])
                try {
                    const channel = channels.get(existingEmbedInfo.channelid) ?? null;
                    const message = await channel.messages.fetch(existingEmbedInfo.messageId) ?? null;
                    const existingEmbedString = getComparableEmbed(message.embeds[0]);
                    const newEmbedString = getComparableEmbed(embedData.embeds[0].data);

                    if (existingEmbedString !== newEmbedString) {
                        await message.edit({
                            embeds: embedData.embeds,
                            ...(embedData.components && { components: embedData.components })
                        });
                        console.log(`✅ Message '${embedName}' updated successfully.`);

                        if (embedData.reactions) {
                            await message.reactions.removeAll();
                            const reactionPromises = embedData.reactions.map(reaction => message.react(reaction));
                            await Promise.all(reactionPromises);
                        }
                    }
                } catch {
                    console.log(`missing embed for ${embedName}, adding to queue...`);
                    await sendEmbedAndSave(guildId, channels, messageIDs, embedName, embedData, guildChannels);
                    return;
                }
            });
        }
    }
    if (embedTasks.length > 0) {
        await Promise.allSettled(embedTasks.map(task => task()));
        try {
            await save('./embeds/embedIDs.json', messageIDs)
            console.log('✅ Successfully saved message IDs to disk.');
        } catch (error) {
            console.error('❌ Failed to save message IDs to disk:', error);
        }
    }
}