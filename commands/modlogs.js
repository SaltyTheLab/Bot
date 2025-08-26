import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { deletePunishment, getPunishments, getUser } from '../Database/databasefunctions.js';
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
    const targetUser = interaction.options.getUser('user');
    const moderatorUser = interaction.user;
    const fiveMinutesInMs = 5 * 60 * 1000;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const usercheck = await getUser(targetUser.id, interaction.guild.id, true);
    let allLogs = await getPunishments(targetUser.id, interaction.guild.id);
    let replyMessage;
    if (!usercheck) {
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x8d0b0b)
                    .setAuthor({ name: `❌ ${targetUser.tag} does not exist in Database!` })
            ],
        });
    } else if (!allLogs.length) {
        //return early with no modlogs found
        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xf58931)
                    .setAuthor({ name: `⚠️ No modlogs found for ${targetUser.tag}.` })
            ],
        });
    }

    let currentIndex = 0;
    let currentLog = allLogs[currentIndex];

    replyMessage = await interaction.reply({
        embeds: [await buildLogEmbed(interaction, targetUser, currentLog, currentIndex, allLogs.length)],
        components: [await buildButtons(currentIndex, allLogs.length, isAdmin, currentLog._id)], fetchReply: true
    });

    const collector = replyMessage.createMessageComponentCollector({
        filter: i => i.user.id === moderatorUser.id,
        time: fiveMinutesInMs
    });

    collector.on('collect', async i => {
        const customIdParts = i.customId.split('-')
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
                    await deletePunishment(targetUser.id, interaction.guild.id, logIdToDelete);
                    logRecentCommand(`log deleted for User ID: ${targetUser.id} | Admin: ${i.user.tag} | Log ID: ${logIdToDelete}`);
                    allLogs = await getPunishments(targetUser.id, interaction.guild.id);

                    if (allLogs.length === 0) {
                        replyMessage = await replyMessage.edit({
                            embeds: [new EmbedBuilder()
                                .setDescription(`All modlogs for ${targetUser} have been deleted.`)],
                            components: []
                        });
                        collector.stop();
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
        replyMessage = await replyMessage.edit({
            embeds: [await buildLogEmbed(interaction, targetUser, currentLog, currentIndex, allLogs.length)],
            components: [await buildButtons(currentIndex, allLogs.length, isAdmin, currentLog._id)],
            fetchReply: true
        });
    });
    collector.on('end', async () => {
        try {
            if (replyMessage.Message.embeds.length > 0 && replyMessage.Message.components[0]) {
                await replyMessage.edit({ components: [await buildButtons(currentIndex, allLogs.length, isAdmin, currentLog._id, true)] });
                console.log(`Modlog buttons for ${targetUser.tag} were disabled automatically.`);
            }
        } catch (error) {
            console.error('Failed to disable buttons automatically:', error);
        }
    });
}
