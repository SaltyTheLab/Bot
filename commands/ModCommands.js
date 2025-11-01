import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder, EmbedBuilder, GuildMember } from "discord.js";
import punishUser from "../moderation/punishUser.js";
export const data = new SlashCommandBuilder()
    .setName('member')
    .setDescription('Warn/Mute/Ban a member')
    .addSubcommand(command =>
        command.setName('warn').setDescription('Warn a member')
            .addUserOption(opt =>
                opt.setName('target').setDescription('The user you want to warn').setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('reason').setDescription('The reason for the warn').setRequired(true)
            )
    )
    .addSubcommand(command =>
        command.setName('mute').setDescription('Mute a user')
            .addUserOption(opt =>
                opt.setName('target').setDescription('The user to mute').setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('reason').setDescription('Reason for the mute').setRequired(true)
            )
            .addIntegerOption(opt =>
                opt.setName('duration').setDescription('Mute duration').setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('unit').setDescription('Mute unit').setRequired(true)
                    .addChoices(
                        { name: 'Minute', value: 'min' },
                        { name: 'Hour', value: 'hour' },
                        { name: 'Day', value: 'day' }
                    )
            )
    )
    .addSubcommand(command =>
        command.setName('ban').setDescription('Ban a user')
            .addUserOption(opt =>
                opt.setName('target').setDescription('The user to ban').setRequired(true)
            )
            .addStringOption(opt =>
                opt.setName('reason').setDescription('Reason for the ban').setRequired(true)
            )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts([InteractionContextType.Guild])
export async function execute(interaction) {
    const command = interaction.options.getSubcommand();
    const target = await interaction.options.getMember('target') ?? await interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');
    const staffcheck = target instanceof GuildMember ? target.permissions.has(PermissionFlagsBits.ModerateMembers) : null
    let banflag = false
    if (target.bot)
        return interaction.reply({ content: 'You cannot ban a bot.', ephemeral: true });

    if (target.id === interaction.user.id) {
        return interaction.reply({ content: '⚠️ You cannot execute mod commands on yourself.', ephemeral: true });
    }

    if (staffcheck) {
        interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setAuthor({ name: target.user.tag + ' is staff, please handle this with an admin, co-owner, or owner.', iconURL: target.displayAvatarURL({ dynamic: true }) })
                    .setColor('#4b0808')
            ],
            ephemeral: true
        })
        return;
    }

    switch (command) {
        case 'mute': {
            const duration = interaction.options.getInteger('duration')
            if (duration <= 0)
                return interaction.reply({ content: '❌ Invalid duration', ephemeral: true });
            if (target.communicationDisabledUntilTimestamp && target.communicationDisabledUntilTimestamp > Date.now())
                return interaction.reply({ content: '⚠️ User is already muted.', ephemeral: true });
            break;
        }
        case 'ban': {
            if (interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
                banflag = true
                break;
            }
            else
                return interaction.reply({ content: 'Jr mods do not have access to this command, please contact a mod or higher in the jr mod chat.' });
        }
    }
    await punishUser({
        interaction: interaction,
        guild: interaction.guild,
        target: target.id,
        moderatorUser: interaction.user,
        reason: reason,
        channel: interaction.channel,
        isAutomated: false,
        automodWarnWeight: 1,
        banflag: banflag,
        buttonflag: false
    });
}