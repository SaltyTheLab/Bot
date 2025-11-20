import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, InteractionContextType, ActionRowBuilder, ButtonStyle, ButtonBuilder, MessageFlags } from 'discord.js';
import { editPunishment, getPunishments, getUser } from '../Database/databasefunctions.js';
async function buildLogEmbed(interaction, log, idx, totalLogs) {
    const LOG_COLORS = { Warn: 0xffcc00, Mute: 0xff4444, Ban: 0xd10000, Kick: 0x838383 };
    const [targetUser, moderator] = await Promise.all(
        [interaction.client.users.fetch(log.userId),
        interaction.client.users.fetch(log.moderatorId)
        ]);
    const formattedDate = new Date(log.timestamp).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'CST'
    });

    const fields = [
        { name: 'Member', value: `<@${log.userId}>`, inline: true },
        { name: 'Type', value: `\`${log.type}\``, inline: true },
    ];
    //add mute duration if log type is mute
    if (log.type === 'Mute' && log.duration) {
        const totalMinutes = Math.round(log.duration / 60000); // convert ms to minutes
        const hours = Math.floor(totalMinutes / 60);

        let durationString;
        if (hours > 0) {
            durationString = `${hours} hour${hours > 1 ? 's' : ''}`;
        } else {
            durationString = `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`;
        }
        fields.push({ name: 'Duration', value: `\`${durationString}\``, inline: false });
    }
    return new EmbedBuilder({
        color: LOG_COLORS[log.type],
        thumbnail: { url: targetUser.displayAvatarURL({ dynamic: true }) },
        fields: [
            ...fields,
            { name: 'Reason', value: `\`${log.reason}\``, inline: false },
            { name: 'Warns at Log Time', value: `\`${log.weight}\``, inline: true },
            { name: 'Log Status', value: log.active == 1 ? '✅ Active' : '❌ Inactive/cleared', inline: true },
            { name: 'Channel', value: `<#${log.channel}>\n\n [Event Link](${log.refrence})`, inline: false }
        ],
        footer: { text: `Staff: ${moderator.tag} | Log ${idx + 1} of ${totalLogs} | ${formattedDate}`, iconURL: moderator.displayAvatarURL({ dynamic: true }) }
    })

};
async function buildButtons(idx, totalLogs, isDeletable, logId, disabled = false) {
    const buttons = [
        new ButtonBuilder({
            custom_id: `modlog-prev`,
            label: '⬅️ Back',
            style: ButtonStyle.Secondary,
            disabled: idx === 0 || disabled
        }),
        new ButtonBuilder({
            custom_id: `modlog-next`,
            label: 'Next ➡️',
            style: ButtonStyle.Secondary,
            disabled: idx >= totalLogs - 1 || disabled
        })
    ];
    if (isDeletable) {
        buttons.push(
            new ButtonBuilder({
                custom_id: `modlog-del-${logId}`,
                label: 'Delete',
                style: ButtonStyle.Danger,
                disabled: disabled
            })
        );
    }
    return new ActionRowBuilder({ components: buttons })
};
export const data = new SlashCommandBuilder()
    .setName('modlogs')
    .setDescription('View a user’s moderation history.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts([InteractionContextType.Guild])
    .addUserOption(option =>
        option.setName('user').setDescription('The user to view').setRequired(true)
    );

export async function execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const fiveMinutesInMs = 5 * 60 * 1000;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const usercheck = await getUser(targetUser.id, interaction.guild.id, true);
    let allLogs = await getPunishments(targetUser.id, interaction.guild.id);
    if (!usercheck) {
        return interaction.reply({
            embeds: [new EmbedBuilder({
                color: 0x8d0b0b,
                author: { name: `❌ ${targetUser.tag} does not exist in Database!` }
            })],
        });
    } else if (!allLogs.length) {
        return interaction.reply({
            embeds: [new EmbedBuilder({
                color: 0xf58931,
                author: { name: `⚠️ No modlogs found for ${targetUser.tag}.` }
            })],
        });
    }

    let currentIndex = 0;
    let currentLog = allLogs[currentIndex];
    let replyMessage = await interaction.reply({
        embeds: [await buildLogEmbed(interaction, currentLog, currentIndex, allLogs.length)],
        components: [await buildButtons(currentIndex, allLogs.length, isAdmin, currentLog._id)],
        withResponse: true
    });

    const collector = replyMessage.resource.message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: fiveMinutesInMs
    });

    collector.on('collect', async i => {
        const customIdParts = i.customId.split('-')
        const action = customIdParts[1];
        const logIdToDelete = customIdParts[2];
        await i.deferUpdate();
        switch (action) {
            case 'del':
                try {
                    await editPunishment({ userId: targetUser.id, guildId: interaction.guild.id, id: logIdToDelete })
                    allLogs = await getPunishments(targetUser.id, interaction.guild.id);
                    if (allLogs.length === 0) {
                        replyMessage = await i.editReply({
                            embeds: [new EmbedBuilder({
                                description: `All modlogs for ${targetUser} have been deleted.`
                            })],
                            components: []
                        });
                        return;
                    }
                    currentIndex = Math.min(currentIndex, allLogs.length - 1)
                } catch (error) {
                    console.error(`Error deleting log ${logIdToDelete}:`, error);
                    await i.followUp({ content: `Failed to delete log: ${error.message}`, flags: MessageFlags.Ephemeral });
                }
                break;
            default: currentIndex = action == 'next' ? Math.min(allLogs.length - 1, currentIndex + 1)
                : Math.max(0, currentIndex - 1)
                break;
        }
        currentLog = allLogs[currentIndex];
        replyMessage = await i.editReply({
            embeds: [await buildLogEmbed(interaction, currentLog, currentIndex, allLogs.length)],
            components: [await buildButtons(currentIndex, allLogs.length, isAdmin, currentLog._id)],
            withResponse: true
        });
    });
    collector.on('end', async () => {
        try {
            if (replyMessage.embeds.length > 0 && replyMessage.components[0]) {
                await replyMessage.edit({ components: [await buildButtons(currentIndex, allLogs.length, isAdmin, currentLog._id, true)] });
                console.log(`Modlog buttons for ${targetUser.tag} were disabled automatically.`);
            }
        } catch (error) {
            console.error('Failed to disable buttons automatically:', error);
        }
    });
}
