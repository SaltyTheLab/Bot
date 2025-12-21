import { viewNotes, getUser, editNote } from '../Database/databaseAndFunctions.js';
async function buildNoteEmbed(api, targetuser, index, currentNote, length) {
    const mod = await api.users.get(currentNote.moderatorId);
    const user = await api.users.get(targetuser)
    const formattedDate = new Date(currentNote.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'CST' });
    return {
        color: 0xdddddd,
        thumbnail: { url: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` },
        description: `<@${user.id}> notes |  \`${index + 1} of ${length}\`\n> ${currentNote.note}`,
        footer: { text: `${mod.username} | ${formattedDate}`, icon_url: `https://cdn.discordapp.com/avatars/${mod.id}/${mod.avatar}.png` }
    }
};
export default {
    data: {
        name: 'note',
        description: 'add/show a user\'s notes',
        default_member_permission: 1 << 8,
        contexts: 0,
        options: [
            {
                name: 'show', description: 'Display a users notes',
                options: [{ name: 'target', description: 'target User', required: true, type: 6 }]
            },
            {
                name: 'add', description: 'Add note to a user',
                options: [
                    { name: 'target', description: 'The User', required: true, type: 6 },
                    { name: 'note', description: 'note to add', required: true, type: 3 }
                ]
            }
        ]
    },
    async execute({ interaction, api }) {
        const targetUser = interaction.data.options[0].options[0].value
        let note = null;
        const guildId = interaction.guild_id
        const embed = { color: 0x00a900, description: `❌ <@${targetUser}> does not exist in the User Database.` }
        if (!await getUser({ userid: targetUser, guildId: interaction.guild_id, modflag: true })) return interaction.reply({ embeds: [embed] });
        switch (interaction.data.options[0].name) {
            case 'add':
                note = interaction.data.options[0].options[1].value
                try { await editNote({ userId: targetUser, moderatorId: interaction.member.user.id, note: note, guildId: guildId }) }
                catch { return await api.interactions.reply(interaction.id, interaction.token, { embeds: [embed] }) }
                embed.color = 0x00a900; embed.description = `📝 note created for <@${targetUser}>\n\n\n > ${note}`;
                return await api.interactions.reply(interaction.id, interaction.token, { embeds: [embed] })
            case 'show': {
                let allnotes = await viewNotes(targetUser, interaction.guild_id);
                if (!allnotes.length) { embed.description = 'No notes found for that user'; return await api.interactions.reply(interaction.id, interaction.token, { embeds: [embed] }); }
                let currentIndex = 0;
                let currentnote = allnotes[currentIndex]
                const buttons = [
                    { type: 2, custom_id: `note-prev-${targetUser}-${currentIndex}`, label: '◀️ prev', style: 2, disabled: currentIndex === 0 },
                    { type: 2, custom_id: `note-next-${targetUser}-${currentIndex}`, label: '▶️ next', style: 2, disabled: currentIndex >= allnotes.length - 1 },
                    { type: 2, custom_id: `note-del-${targetUser}-${currentIndex}`, label: '🗑️ delete', style: 4, disabled: false }
                ]
                await api.interactions.reply(interaction.id, interaction.token, {
                    embeds: [await buildNoteEmbed(api, targetUser, currentIndex, currentnote, allnotes.length)],
                    components: [{ type: 1, components: buttons }]
                });
            }
        }
    }
}

