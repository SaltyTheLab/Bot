import { guildconfigs } from "./Database";
import { MessageFlags, Routes, type APIEmbed, type APIMessage, type APIMessageComponent, type APIMessageTopLevelComponent, type REST } from "discord.js";

function getComparableEmbed(embedData: APIEmbed): string | null {
    if (!embedData) return null; const normalizeText = (text: string | null) => text ? text.replace(/\r\n/g, '\n').trim() : null;
    return JSON.stringify({
        title: embedData.title ? normalizeText(embedData.title) : null,
        description: embedData.description ? normalizeText(embedData.description) : null,
        url: embedData.url ? normalizeText(embedData.url) : null,
        color: embedData.color ?? null,
        fields: embedData.fields ? embedData.fields.map(field => ({ name: normalizeText(field.name), value: normalizeText(field.value), inline: field.inline || false })) : [],
        image: normalizeAttachmentUrl(embedData.image?.url),
        thumbnail: normalizeAttachmentUrl(embedData.thumbnail?.url),
        author: embedData.author ? { name: normalizeText(embedData.author.name) } : null,
        footer: embedData.footer ? { text: normalizeText(embedData.footer.text) } : null
    });
}

function normalizeAttachmentUrl(url?: string | null): string | null {
    if (!url) return null;
    if (url.startsWith('attachment://')) return url;
    try {
        const parsed = new URL(url);
        if (['cdn.discordapp.com', 'media.discordapp.net'].includes(parsed.hostname) && parsed.pathname.includes('/attachments/')) {
            const filename = parsed.pathname.split('/').pop();
            if (filename) return `attachment://${decodeURIComponent(filename)}`;
        }
    } catch { }
    return url;
}

function getComparableComponents(components: APIMessageComponent[] | undefined): string {
    const mediaMetadata = new Set(['proxy_url', 'width', 'height', 'placeholder', 'placeholder_version', 'content_type', 'loading_state', 'attachment_id', 'flags']);
    const normalize = (value: any): any => {
        if (Array.isArray(value)) return value.map(normalize);
        if (!value || typeof value !== 'object') return value;
        const isComponent = typeof value.type === 'number';
        const isMedia = typeof value.url === 'string' && ('proxy_url' in value || 'width' in value || 'attachment_id' in value);
        return Object.fromEntries(Object.entries(value)
            .filter(([property, propertyValue]) => {
                if (isComponent && property === 'id') return false;
                if (isComponent && value.type === 13 && (property === 'name' || property === 'size')) return false;
                if (isMedia && mediaMetadata.has(property)) return false;
                if ((property === 'spoiler' || property === 'disabled') && propertyValue === false) return false;
                if (property === 'description' && (propertyValue === null || propertyValue === '')) return false;
                return true;
            })
            .map(([property, propertyValue]) => [property, property === 'url' && typeof propertyValue === 'string' ? normalizeAttachmentUrl(propertyValue) : normalize(propertyValue)]));
    };
    return JSON.stringify((components || []).map(normalize));
}

export async function syncEmbed(rest: REST, guildId: string, embedName: string, config: { channelid: string, embeds: APIEmbed[], components: APIMessageTopLevelComponent[], reactions?: { emoji: string; roleId: string }[], format: string, messageId?: string }, files: { name: string; data: Buffer; key: string; contentType?: string }[] = []) {
    const { channelid, embeds, components, reactions, format, messageId: existingMessageId } = config;
    const buildBody = (existingAttachments: { id: string; filename: string }[] = []) => {
        const body = format === 'v2' ? { flags: MessageFlags.IsComponentsV2, components } as APIMessage : { embeds, components } as APIMessage;
        if (files.length || existingAttachments.length) {
            (body as any).attachments = [
                ...existingAttachments,
                ...files.map((file, index) => ({ id: String(index), filename: file.name })),
            ];
        }
        return body;
    };
    if (!existingMessageId) {
        const message = await rest.post(Routes.channelMessages(channelid), { body: buildBody(), files: files.length ? files : undefined }) as APIMessage;
        await guildconfigs.updateOne({ guildId }, { $set: { [`messageConfigs.${embedName}.messageId`]: message.id } });
        for (const reaction of reactions || [])
            await rest.put(Routes.channelMessageOwnReaction(channelid, message.id, reaction.emoji));
        return { status: 'sent', messageId: message.id };
    }
    const message = await rest.get(Routes.channelMessage(channelid, existingMessageId)) as APIMessage;
    const componentsDifferent = getComparableComponents(message.components) !== getComparableComponents(components);
    const embedsDifferent = message.embeds.map((embed) => getComparableEmbed(embed)).join('|||') !== embeds.map((embed) => getComparableEmbed(embed)).join('|||');
    const different = files.length > 0 || componentsDifferent || (format !== 'v2' && embedsDifferent);
    if (different) await rest.patch(Routes.channelMessage(channelid, message.id), {
        body: buildBody(message.attachments.map(attachment => ({ id: attachment.id, filename: attachment.filename }))),
        files: files.length ? files : undefined,
    });
    await guildconfigs.updateOne({ guildId: guildId }, { $set: { [`messageConfigs.${embedName}.messageId`]: message.id } });
    return { status: !existingMessageId ? 'sent' : 'updated', messageId: message.id, changed: different };
}