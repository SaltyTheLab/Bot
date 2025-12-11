import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder, GuildMember, EmbedBuilder } from "discord.js";
import { getPunishments, editPunishment } from "../Database/databaseAndFunctions.js";
import punishUser from "../moderation/punishUser.js";
import guildchannelmap from "../Extravariables/guildconfiguration.json" with {type: 'json'}
export const data = new SlashCommandBuilder()
    .setName('member')
    .setDescription('Warn/Mute/Ban/kick/unwarn/unmute a member')
    .addSubcommand(command =>
        command.setName('warn').setDescription('Warn a member')
            .addUserOption(opt => opt.setName('target').setDescription('The user you want to warn').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('The reason for the warn').setRequired(true)))
    .addSubcommand(command =>
        command.setName('mute').setDescription('Mute a user')
            .addUserOption(opt => opt.setName('target').setDescription('The user to mute').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for the mute').setRequired(true))
            .addIntegerOption(opt => opt.setName('duration').setDescription('Mute duration').setRequired(true))
            .addStringOption(opt => opt.setName('unit').setDescription('Mute unit').setRequired(true)
                .addChoices({ name: 'Minute', value: 'min' }, { name: 'Hour', value: 'hour' }, { name: 'Day', value: 'day' })))
    .addSubcommand(command =>
        command.setName('ban').setDescription('Ban a user')
            .addUserOption(opt => opt.setName('target').setDescription('The user to ban').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for the ban').setRequired(true)))
    .addSubcommand(command =>
        command.setName('kick').setDescription('Kick a user')
            .addUserOption(opt => opt.setName('target').setDescription('The user to kick').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for the kick').setRequired(true)))
    .addSubcommand(command => command.setName('unwarn').setDescription('Removes a user\'s recent warn')
        .addUserOption(opt => opt.setName('target').setDescription('User to remove warn from').setRequired(true))
    )
    .addSubcommand(command => command.setName('unmute').setDescription('Unmutes a user')
        .addUserOption(opt => opt.setName('target').setDescription('The user to unmute').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts([InteractionContextType.Guild])
export async function execute(interaction) {
    const target = await interaction.options.getMember('target') ?? await interaction.options.getUser('target');
    const staffcheck = target instanceof GuildMember ? target.permissions.has(PermissionFlagsBits.ModerateMembers) : null
    const adminChannel = interaction.client.channels.cache.get(guildchannelmap[interaction.guild.id].modChannels.adminChannel) ?? null
    let banflag = false
    let kick = false
    if (target.bot) return interaction.reply({ content: 'You cannot ban a bot.', flags: 64 });
    if (target.id === interaction.user.id) return interaction.reply({ content: '⚠️ You cannot execute mod commands on yourself.', flags: 64 });
    if (staffcheck) return interaction.reply({ content: `${target.user.tag} is staff, please handle this with an admin, co-owner, or owner.`, flags: 64 })
    switch (interaction.options.getSubcommand()) {
        case 'mute':
            if (interaction.options.getInteger('duration') <= 0) return interaction.reply({ content: '❌ Invalid duration', flags: 64 });
            if (target.communicationDisabledUntilTimestamp && target.communicationDisabledUntilTimestamp > Date.now()) return interaction.reply({ content: '⚠️ User is already muted.', flags: 64 });
            break;
        case 'ban':
            if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
                adminChannel.send({ content: `Jr. mod ${interaction.user} tried to use the ban command, please talk to them if you see multiple instances of this message...` })
                return interaction.reply({ content: 'Jr mods do not have access to this command, please contact a mod or higher in the jr mod chat.', flags: 64 });
            }
            banflag = true
            break;
        case 'kick':
            kick = true
            break;
        case 'unwarn': {
            let punishments = await getPunishments(target.id, interaction.guild.id, true)
            if (punishments.length < 1) return interaction.reply({ embeds: [new EmbedBuilder({ description: `no warns found for ${target}` })] })
            const warns = punishments.filter(warn => warn.type == 'Warn')
            const recentwarn = warns[punishments.length - 1]
            editPunishment({ userId: target.id, guildId: interaction.guild.id, id: recentwarn._id })
            return interaction.reply({ embeds: [new EmbedBuilder({ description: `recent warn removed from ${target}` })] })
        }
        case 'unmute': {
            const member = await interaction.guild.members.fetch(target.id);
            const embed = new EmbedBuilder({ color: 0xb50000, description: `${target} is not muted.` })
            if (member.communicationDisabledUntil) { await member.timeout(null); embed.setColor(0x00a900).setDescription(`${target.tag} was unmuted.`) }
            return interaction.reply({ embeds: [embed] })
        }
    }
    punishUser({ interaction: interaction, guild: interaction.guild, target: target, moderatorUser: interaction.user, reason: interaction.options.getString('reason'), channel: interaction.channel, banflag: banflag, kick: kick });
}