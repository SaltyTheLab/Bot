import { EmbedBuilder } from 'discord.js';
import guildChannelMap from "../BotListeners/Extravariables/guildconfiguration.json" with {type: 'json'};
import { load, save } from '../utilities/jsonloaders.js';
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
async function sendEmbedAndSave(guild, messageIDs, embedName, embedData, guildChannels) {
    const channel = await guild.channels.fetch(guildChannels[embedName]);
    try {
        const oldMessageIndex = messageIDs[guild.id].findIndex((message) => message.name === embedName) ?? null;
        if (oldMessageIndex && oldMessageIndex !== -1) {
            // Found an old message with the same name, so we remove it.
            messageIDs[guild.id].splice(oldMessageIndex, 1);
        }
    } catch (err) {
        console.log(`error sending embed for ${embedName}: `, err)
    }
    const { embeds, components } = embedData;
    const msg = await channel.send({ embeds, components, fetchReply: true });
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
    if (!messageIDs[guild.id]) {
        // If the guild doesn't exist in our object, create an entry for it
        messageIDs[guild.id] = [];
    }
    messageIDs[guild.id].push({
        name: embedName,
        messageId: msg.id,
        channelid: channel.id,
    });
}
function generateEmbedData(configData, guild) {
    const config = typeof configData === 'function' ? configData(guild) : configData
    const embed = new EmbedBuilder(config.embeds)
    const reactions = config.reactions || null
    const components = config.components || null
    return {
        embeds: [embed],
        components: components,
        reactions: reactions
    }
}
export default async function embedsenders(guilds) {
    let embedTasks = [];
    for (const [guildId, guild] of guilds) {
        const guildConfig = guildEmbedConfig[guildId];
        if (!guildConfig) {
            console.log(`No embed configuration found for guild ID: ${guild.id}`);
            continue;
        }
        const guildChannels = guildChannelMap[guild.id].publicChannels;
        if (!guildChannels) {
            console.error(`❌ No channel mapping found for guild ID: ${guild.id}. Please check guildChannelMap.`);
            continue;
        }
        for (const embedName in guildConfig) {
            const configData = guildConfig[embedName]
            const existingEmbedInfo = messageIDs[guildId]?.find((embed) => embed.name === embedName);
            embedTasks.push(async () => {
                try {
                    const embedData = generateEmbedData(configData, guild)
                    if (!existingEmbedInfo) {
                        console.log(`missing embed for ${embedName}, adding to queue...`);
                        await sendEmbedAndSave(guild, messageIDs, embedName, embedData, guildChannels);
                        return;
                    }
                    const channel = await guild.client.channels.fetch(existingEmbedInfo.channelid) ?? null;
                    const message = await channel.messages.fetch(existingEmbedInfo.messageId) ?? null;
                    const existingEmbedString = getComparableEmbed(message.embeds[0]);
                    const newEmbedString = getComparableEmbed(embedData.embeds[0].data);

                    if (existingEmbedString !== newEmbedString) {
                        await message.edit({
                            embeds: embedData.embeds,
                            ...(embedData.components && { components: embedData.components })
                        });
                        console.log(`✅ Message '${embedName}' updated successfully.`);

                        // Handle reactions
                        if (embedData.reactions) {
                            await message.reactions.removeAll();
                            const reactionPromises = embedData.reactions.map(reaction => message.react(reaction));
                            await Promise.all(reactionPromises);
                        }
                    }
                } catch (error) {
                    console.error(`❌ Failed to update or fetch message '${embedName}':`, error);
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
