import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder, GuildMember, MessageFlags } from "discord.js";
import punishUser from "../moderation/punishUser.js";
export const data = new SlashCommandBuilder()
    .setName('member')
    .setDescription('Warn/Mute/Ban/kick a member')
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
                .addChoices(
                    { name: 'Minute', value: 'min' },
                    { name: 'Hour', value: 'hour' },
                    { name: 'Day', value: 'day' }
                )))
    .addSubcommand(command =>
        command.setName('ban').setDescription('Ban a user')
            .addUserOption(opt => opt.setName('target').setDescription('The user to ban').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for the ban').setRequired(true)))
    .addSubcommand(command =>
        command.setName('kick').setDescription('Kick a user')
            .addUserOption(opt => opt.setName('target').setDescription('The user to kick').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for the kick').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts([InteractionContextType.Guild])
export async function execute(interaction) {
    const command = interaction.options.getSubcommand();
    const target = await interaction.options.getMember('target') ?? await interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');
    const staffcheck = target instanceof GuildMember ? target.permissions.has(PermissionFlagsBits.ModerateMembers) : null
    const duration = interaction.options.getInteger('duration') ?? null
    let banflag = false
    let kick = false
    if (target.bot)
        return interaction.reply({ content: 'You cannot ban a bot.', flags: MessageFlags.Ephemeral });
    if (target.id === interaction.user.id)
        return interaction.reply({ content: '⚠️ You cannot execute mod commands on yourself.', flags: MessageFlags.Ephemeral });
    if (staffcheck)
        return interaction.reply({ content: `${target.user.tag} is staff, please handle this with an admin, co-owner, or owner.`, flags: MessageFlags.Ephemeral })
    switch (command) {
        case 'mute':
            if (duration <= 0)
                return interaction.reply({ content: '❌ Invalid duration', flags: MessageFlags.Ephemeral });
            if (target.communicationDisabledUntilTimestamp && target.communicationDisabledUntilTimestamp > Date.now())
                return interaction.reply({ content: '⚠️ User is already muted.', flags: MessageFlags.Ephemeral });
            break;
        case 'ban':
            if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers))
                return interaction.reply({ content: 'Jr mods do not have access to this command, please contact a mod or higher in the jr mod chat.', flags: MessageFlags.Ephemeral });
            banflag = true
            break;
        case 'kick':
            kick = true
            break;
    }
    await punishUser({
        interaction: interaction,
        guild: interaction.guild,
        target: target,
        moderatorUser: interaction.user,
        reason: reason,
        channel: interaction.channel, banflag: banflag,
        kick: kick
    });
}