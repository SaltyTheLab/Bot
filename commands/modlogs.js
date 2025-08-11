import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, PermissionFlagsBits } from 'discord.js';
import { deletePunishment, getPunishments } from '../Database/databasefunctions.js';
import { buildLogEmbed, buildButtons } from '../utilities/buildmodlogembeds.js';
import logRecentCommand from '../Logging/recentcommands.js';

export const data = new SlashCommandBuilder()
    .setName('modlogs')
    .setDescription('View a user’s moderation history.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
        option.setName('user').setDescription('The user to view').setRequired(true)
    );

export async function execute(interaction) {
    // get user, moderator, and database moderator
    const targetUser = interaction.options.getUser('user');
    const moderatorUser = interaction.user;
    const moderatorMember = interaction.member;
    const fiveMinutesInMs = 5 * 60 * 1000;

    if (!moderatorMember) {
        return interaction.reply({ content: "Error: Could not determine your permissions.", ephemeral: true });
    }
    //define isAdmin for ease of reading
    const isAdmin = moderatorMember.permissions.has(PermissionsBitField.Flags.Administrator);

    // Fetch all logs only
    let allLogs = await getPunishments(targetUser.id, interaction.guild.id);

    //return early with no modlogs found
    if (!allLogs.length) {
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x888888)
                    .setAuthor({ name: `⚠️ No modlogs found for ${targetUser.tag}.` })
            ],
            ephemeral: true
        });
    }

    let currentIndex = 0;
    let currentLog = allLogs[currentIndex];

    //send embed
    const replyMessage = await interaction.reply({
        embeds: [await buildLogEmbed(interaction, currentLog, currentIndex, allLogs.length)],
        components: [await buildButtons(currentIndex, allLogs.length, isAdmin, currentLog.id)]
    });

    const collector = replyMessage.createMessageComponentCollector({
        filter: i => i.user.id === moderatorUser.id,
        time: fiveMinutesInMs
    });

    collector.on('collect', async i => {
        const customIdParts = i.customId.split('_')
        const action = customIdParts[1];
        const logIdToDelete = customIdParts[2];
        await i.deferUpdate();
        switch (action) {
            case 'prev':
            case 'next':
                currentIndex = action == 'next' ? Math.min(allLogs.length - 1, currentIndex + 1)
                    : Math.max(0, currentIndex - 1)
                break;
            case 'del':
                try {
                    deletePunishment(logIdToDelete);
                    logRecentCommand(`log deleted for User ID: ${targetUser.id} | Admin: ${i.user.tag} | Log ID: ${logIdToDelete}`);
                    allLogs = await getPunishments(targetUser.id, interaction.guild.id);

                    if (allLogs.length === 0) {
                        await interaction.editReply({
                            content: `All modlogs for <@${targetUser.id}> have been deleted.`,
                            embeds: [],
                            components: []
                        });
                        return;
                    }
                    currentIndex = Math.min(currentIndex, allLogs.length - 1)
                } catch (error) {
                    console.error(`Error deleting log ${logIdToDelete}:`, error);
                    await i.followUp({ content: `Failed to delete log: ${error.message}`, ephemeral: true });
                }
                break;
        }
        currentLog = allLogs[currentIndex];
        await i.editReply({
            embeds: [await buildLogEmbed(interaction, currentLog, currentIndex, allLogs.length)],
            components: [await buildButtons(currentIndex, allLogs.length, isAdmin, currentLog.id, false)]
        });
    });
    collector.on('end', async () => {
            try {
                const finalButtons = await buildButtons(currentIndex, allLogs.length, isAdmin, allLogs[currentIndex].id, true);
                await replyMessage.edit({ components: [finalButtons] });
                console.log(`Modlog buttons for ${targetUser.tag} were disabled automatically.`);
            } catch (error) {
                console.error('Failed to disable buttons automatically:', error);
            }
    });
}
