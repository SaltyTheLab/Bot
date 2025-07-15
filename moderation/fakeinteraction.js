export function buildFakeInteraction(client, message, reasonText) {
    return {
        guild: message.guild,
        member: message.member,
        user: client.user,
        channel: message.channel,
        options: {
            getUser: key => key === 'target' ? message.author : null,
            getString: key => key === 'reason' ? reasonText : null,
        },
        replied: false,
        deferred: false,
        reply: async (res) => {
            await message.channel.send(typeof res === 'string' ? { content: res } : res);
        },
        editReply: async (res) => {
            await message.channel.send(res);
        },
    };
}
