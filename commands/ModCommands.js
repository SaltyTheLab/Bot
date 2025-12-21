import { getPunishments, editPunishment } from "../Database/databaseAndFunctions.js";
import punishUser from "../moderation/punishUser.js";
import guildchannelmap from "../Extravariables/guildconfiguration.json" with {type: 'json'}
export default {
    data: {
        name: 'member',
        description: 'Warn/Mute/Ban/kick/unwarn/unmute a member',
        default_member_permission: 1 << 8,
        contexts: 0,
        options: [
            {
                name: 'warn', description: 'Warn a member',
                options: [
                    { name: 'target', description: 'The user you want to warn', required: true, type: 6 },
                    { name: 'reason', description: 'The reason for the warn', required: true, type: 3 }
                ]
            },
            {
                name: 'mute', description: 'Mute a user',
                options: [
                    { name: 'target', description: 'The user to mute', required: true, type: 6 },
                    { name: 'reason', description: 'Reason for the mute', required: true, type: 3 },
                    { name: 'duration', description: 'Mute duration', required: true, type: 4 },
                    {
                        name: 'unit', description: 'Mute unit', required: true, type: 3,
                        choices: [{ name: 'Minute', value: 'min' }, { name: 'Hour', value: 'hour' }, { name: 'Day', value: 'day' }]
                    }
                ]
            },
            {
                name: 'ban', description: 'Ban a user',
                options: [
                    { name: 'target', description: 'The user to ban', required: true, type: 6 },
                    { name: 'reason', description: 'Reason for the ban', required: true, type: 3 }
                ]
            },
            {
                name: 'kick', description: 'Kick a user',
                options: [
                    { name: 'target', description: 'The user to kick', required: true, type: 6 },
                    { name: 'reason', description: 'Reason for the kick', required: true, type: 3 }]
            },
            { name: 'unwarn', description: 'Removes a user\'s warn', options: [{ name: 'target', description: 'The User', required: true, type: 6 }] },
            { name: 'unmute', description: 'Unmutes a user', options: [{ name: 'target', description: 'The User', required: true, type: 6 }] },
        ]
    },
    async execute({ interaction, api }) {
        const target = interaction.data.resolved.users[interaction.member.user.id];
        const guild = await api.guilds.get(interaction.guild_id)
        const staffroles = ['1306337128426377296', '1235295120665088030', '1409208962091585607', '1388113570369372181']
        const juniorroles = ['1422366564031660176', '1402282104401821828']
        const adminChannel = guildchannelmap[interaction.guild_id].modChannels.adminChannel
        const punishments = await getPunishments(target.id, interaction.guild.id, true)
        const embed = { color: 0xb50000, description: `${target} is not muted.` }
        const highermodcommands = ['ban', 'unwarn', 'unmute'];
        let reason = null
        let banflag = false
        let kick = false
        let recentwarn = null;
        const command = interaction.data.options[0]
        if (target.bot) { embed.description = 'You cannot moderate a bot.'; return await api.interactions.reply(interaction.id, interaction.token, { embeds: [embed], flags: 64 }); }
        if (target.id === interaction.member.user.id) {
            embed.description = '⚠️ You cannot moderate yourself.';
            return await api.interactions.reply(interaction.id, interaction.token, { embeds: [embed], flags: 64 });
        }
        if (interaction.member.roles.some(roleId => staffroles.includes(roleId))) {
            embed.description = `${interaction.user} tried to moderate ${target}.`; await api.channels.send(adminChannel, { embeds: [embed] });
            embed.description = `you cannot moderate other staff members.`; return await api.interactions.reply(interaction.id, interaction.token, { embeds: [embed], flags: 64 })
        }
        if (interaction.member.roles.some(role => role.includes(juniorroles)) && highermodcommands.includes(interaction.data.name)) {
            embed.description = `Jr. mod ${interaction.user} tried to use a mod only command.`; await api.channels.send(adminChannel, { embeds: [embed] })
            embed.description = 'Jr mods do not have access to this command.'; return await api.interactions.reply(interaction.id, interaction.token, { embeds: [embed], flags: 64 });
        }
        switch (command.name) {
            case 'mute':
                reason = command.options[1].value
                if (command.options[2].value <= 0) {
                    embed.description = '❌ Invalid duration'
                    return await api.interactions.reply(interaction.id, interaction.token, { embeds: [embed] });
                }
                if (target.communicationDisabledUntilTimestamp && target.communicationDisabledUntilTimestamp > Date.now()) {
                    embed.description = '⚠️ User is already muted.'
                    return await api.interactions.reply(interaction.id, interaction.token, { embeds: [embed], flags: 64 });
                }
                break;
            case 'kick': kick = true; reason = command.options[1].value;
                break;
            case 'ban': reason = command.options[1].valuebanflag = true
                break;
            case 'warn': reason = command.options[1].value
                break;
            case 'unwarn':
                recentwarn = punishments.filter(warn => warn.type == 'Warn').pop();
                if (!recentwarn) {
                    embed.description = `no warns found for ${target.username}`; return await api.interactions.reply(interaction.id, interaction.token, { embeds: [embed] });
                }
                editPunishment({ userId: target.id, guildId: interaction.guild_id, id: recentwarn._id })
                embed.color = 0x00a900; embed.description = `recent warn removed from ${target.username}`;
                return await api.interactions.reply(interaction.id, interaction.token, { embeds: [embed] });
            case 'unmute':
                if (target.communicationDisabledUntil) { await target.timeout(null); embed.color = 0x00a900; embed.description = `${target.username} was unmuted.` }
                return await api.interactions.reply(interaction.id, interaction.token, { embeds: [embed] });

        }
        punishUser({ api: api, interaction: interaction, guild: guild, target: target, moderatorUser: interaction.member.user, reason: reason, channelId: interaction.channel.id, banflag: banflag, kick: kick });
    }
}
