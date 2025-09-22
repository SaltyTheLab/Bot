export default function getComparableEmbed(embedData) {
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