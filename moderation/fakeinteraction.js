
export function buildFakeInteraction(client, message, reasonText, convertedpunishment, activeWarnings, unit, durationMs) {
    return {
        guild: message.guild,
        member: message.member,
        reasonText,
        user: client.user,
        channel: message.channel,
        nextPunishment: convertedpunishment,
        activeWarnings: activeWarnings,
        options: {
            getUser: key => key === 'target' ? message.author : null,
            getString: key => {
                if (key === 'reason') return reasonText;
                if (key === 'unit') return unit;
                return null;
            },
            getInteger: (key) => {
                if (key === 'duration') return durationMs;
                return null;

            }
        },
        replied: false,
        deferred: false,
        reply: async (res) => {
            await message.channel.send(typeof res === 'string' ? { content: res } : res);
        },
        editReply: async (res) => {
            await message.channel.send(res);
        },
    }
}
