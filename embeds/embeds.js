import { load, save } from '../utilities/fileeditors.js';
const messageIDs = await load('./embeds/embedIDs.json');

function getComparableEmbed(embedData) {
    if (!embedData) return null; const normalizeText = (text) => text ? text.replace(/\r\n/g, '\n').trim() : null;
    const cleanmessage = {
        title: normalizeText(embedData.title), description: normalizeText(embedData.description), url: normalizeText(embedData.url),
        color: embedData.color ?? null,
        fields: embedData.fields ? embedData.fields.map(field => ({ name: normalizeText(field.name), value: normalizeText(field.value), inline: field.inline || false })) : [],
        author: embedData.author ? { name: normalizeText(embedData.author.name) } : null,
        footer: embedData.footer ? { text: normalizeText(embedData.footer.text) } : null
    }
    return JSON.stringify(cleanmessage);
}
export default async function embedsenders(guildId, api) {
    const guildChannelMap = await load("./Extravariables/guildconfiguration.json")
    if (!messageIDs[guildId]) messageIDs[guildId] = [];
    const messageconfigs = guildChannelMap[guildId].messageConfigs ?? null
    if (!messageconfigs) { console.log(`No config found for guild ID: ${guildId}`); return; }
    const embedTasks = Object.entries(messageconfigs).map(async ([embedName, config]) => {
        const { channelid, embeds, components, reactions } = config;
        const embed = embeds.map(e => { if (typeof e.color === 'string') e.color = parseInt(e.color.replace('#', ''), 16); return e; });
        try {
            const existingdata = messageIDs[guildId]?.find(m => m.name === embedName)
            const message = await api.channels.getMessage(channelid, existingdata.messageId);
            const different = message.embeds.map(embed => getComparableEmbed(embed)).join('|||') !== embed.map(embed => getComparableEmbed(embed)).join('|||')
            if (different) { await api.channels.editMessage(channelid, message.id, { embeds: embed, ...components }); console.log(`✅ Message '${embedName}' updated.`); }
        } catch {
            const msg = await api.channels.createMessage(channelid, { embeds: embed, components: components });
            messageIDs[guildId] = messageIDs[guildId].filter((message) => message.name !== embedName);
            if (reactions) for (const reaction of reactions) await api.channels.addMessageReaction(channelid, msg.id, reaction)
            console.log(`📝 Sent '${embedName}'. Message ID: `, msg.id);
            messageIDs[guildId].push({ name: embedName, messageId: msg.id })
        }
    })
    await Promise.allSettled(embedTasks);
    await save('./embeds/embedIDs.json', messageIDs);
}
