import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } from 'discord.js';
import logRecentCommand from '../Logging/recentCommands.js';
import { getPunishments } from '../Database/databaseFunctions.js';
import { buildLogEmbed, buildButtons } from '../utilities/buildembed.js';

export const data = new SlashCommandBuilder()
    .setName('modlogs')
    .setDescription('View a user’s moderation history.')
    .addUserOption(option =>
        option.setName('user').setDescription('The user to view').setRequired(true)
    );

export async function execute(interaction) {
    // get user, moderator, and database moderator
    const targetUser = interaction.options.getUser('user');
    const moderatorUser = interaction.user;
    const moderatorMember = interaction.member;
    const twoMinutesInMs = 2 * 60 * 1000;

    if (!moderatorMember) {
        return interaction.reply({ content: "Error: Could not determine your permissions.", ephemeral: true });
    }
    //define isAdmin for ease of reading
    const isAdmin = moderatorMember.permissions.has(PermissionsBitField.Flags.Administrator);

    // Fetch all logs only
    let allLogs = await getPunishments(targetUser.id);

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

    const currentIndex = 0;
    const currentLog = allLogs[currentIndex];

    // Log the command usage
    logRecentCommand(`Modlogs command used by ${moderatorUser.tag} for user ${targetUser.tag}`);

    const timestamp = Date.now();

    //send embed
    const replyMessage = await interaction.reply({
        embeds: [await buildLogEmbed(interaction, currentLog, currentIndex, allLogs.length, targetUser)],
        components: [await buildButtons(currentIndex, allLogs.length, targetUser.id, isAdmin && currentLog.active, currentLog.id, currentLog.type, timestamp)],
        ephemeral: false
    });

    setTimeout(async () => {
        try {
            await replyMessage.edit({ components: [await buildButtons(currentIndex, allLogs.length, targetUser.id, isAdmin && currentLog.active, currentLog.id, currentLog.type, timestamp, true)] });
            console.log(`Modlog buttons for ${targetUser.tag} were disabled automatically.`);
        } catch (error) {
            console.error('Failed to disable buttons automatically:', error);
            // This might happen if the message was deleted before the timeout
        }
    }, twoMinutesInMs)
}
