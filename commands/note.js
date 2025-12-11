import { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } from "discord.js";
import { viewNotes, getUser, editNote } from '../Database/databaseAndFunctions.js';
async function buildNoteEmbed(interaction, targetUser, index, currentNote, length) {
    const mod = await interaction.client.users.fetch(currentNote.moderatorId);
    const formattedDate = new Date(currentNote.timestamp).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'CST'
    });
    return new EmbedBuilder({
        color: 0xdddddd,
        thumbnail: { url: targetUser.displayAvatarURL({ dynamic: true }) },
        description: `<@${currentNote.userId}> notes |  \`${index + 1} of ${length}\`\n> ${currentNote.note}`,
        footer: { text: `${mod.tag} | ${formattedDate}`, iconURL: mod.displayAvatarURL({ dynamic: true }) }
    })
};
export const data = new SlashCommandBuilder()
    .setName('note')
    .setDescription('add/show a users notes')
    .addSubcommand(command =>
        command.setName('show').setDescription('Display a users notes').addUserOption(opt =>
            opt.setName('target').setDescription('target user').setRequired(true)))
    .addSubcommand(command =>
        command.setName('add').setDescription('Add note to a user').addUserOption(opt =>
            opt.setName('target').setDescription('add a note to a user').setRequired(true))
            .addStringOption(opt =>
                opt.setName('note').setDescription('note to add').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts([InteractionContextType.Guild])

export async function execute(interaction) {
    const targetUser = interaction.options.getUser('target')
    const note = interaction.options.getString('note')
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    const guildId = interaction.guild.id
    const fiveMinutesInMs = 5 * 60 * 1000;
    if (!await getUser({ userid: targetUser.id, guildId: interaction.guild.id, modflag: true }))
        return interaction.reply({ content: `❌ ${targetUser.tag} does not exist in the User Database.` })
    switch (interaction.options.getSubcommand()) {
        case 'add':
            try { editNote({ userId: targetUser.id, moderatorId: interaction.user.id, note: note, guildId: guildId }) }
            catch { return interaction.reply({ content: `${targetUser.tag} is not in the User Database` }); }
            interaction.reply({ embeds: [new EmbedBuilder({ color: 0x00a900, description: `📝 note created for <@${targetUser.id}>\n\n\n > ${note}` })] })
            break;
        case 'show': {
            let allnotes = await viewNotes(targetUser.id, interaction.guild.id);
            if (!allnotes.length) return interaction.reply({ embeds: [new EmbedBuilder({ color: 0xa9a900, description: 'No notes found for that user' })] });
            let currentIndex = 0;
            let currentnote = allnotes[currentIndex]
            const initialResponse = await interaction.reply({
                embeds: [await buildNoteEmbed(interaction, targetUser, currentIndex, currentnote, allnotes.length)],
                components: [{
                    type: 1,
                    components: [
                        { type: 2, custom_id: `prev`, label: '◀️ prev', style: 2, disabled: currentIndex === 0 },
                        { type: 2, custom_id: `next`, label: '▶️ next', style: 2, disabled: currentIndex >= allnotes.length - 1 },
                        { type: 2, custom_id: `del`, label: '🗑️ delete', style: 4, disabled: false }
                    ]
                }],
                withResponse: true
            });
            const collector = initialResponse.resource.message.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: fiveMinutesInMs
            })
            let replyMessage = initialResponse.resource.message;
            collector.on('collect', async i => {
                await i.deferUpdate();
                switch (i.customId) {
                    case 'del': {
                        if (currentnote.timestamp - Date.now() < 48 * 60 * 60 * 1000 || isAdmin) {
                            editNote({ userId: targetUser.id, guildId: guildId, id: currentnote._id })
                            allnotes = await viewNotes(targetUser.id, interaction.guild.id);
                            if (allnotes.length === 0) {
                                replyMessage.edit({ embeds: [new EmbedBuilder({ description: `All notes for ${targetUser} deleted.` })], components: [] });
                                return;
                            }
                        } else
                            interaction.reply({ content: `${interaction.user}, please contact an admin as time has expired.`, flags: 64 })
                        currentIndex = Math.min(currentIndex, allnotes.length - 1)
                        break;
                    }
                    default: currentIndex = i.customId == 'next' ? Math.min(allnotes.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1)
                        break;

                }
                currentnote = allnotes[currentIndex]
                replyMessage = await replyMessage.edit({
                    embeds: [await buildNoteEmbed(interaction, targetUser, currentIndex, currentnote, allnotes.length)],
                    components: [{
                        type: 1,
                        components: [
                            { type: 2, custom_id: `prev`, label: '◀️ prev', style: 2, disabled: currentIndex === 0 },
                            { type: 2, custom_id: `next`, label: '▶️ next', style: 2, disabled: currentIndex >= allnotes.length - 1 },
                            { type: 2, custom_id: `del`, label: '🗑️ delete', style: 4, disabled: false }
                        ]
                    }]
                });
            });
            collector.on('end', async () => {
                if (allnotes.length > 0) replyMessage.edit({
                    components: [{
                        type: 1,
                        components: [
                            { type: 2, custom_id: `prev`, label: '◀️ prev', style: 2, disabled: true },
                            { type: 2, custom_id: `next`, label: '▶️ next', style: 2, disabled: true },
                            { type: 2, custom_id: `del`, label: '🗑️ delete', style: 4, disabled: true }
                        ]
                    }]
                });
            });
        }
            break;
    }
}