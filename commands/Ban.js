import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder, EmbedBuilder, GuildMember } from "discord.js";
import punishUser from "../moderation/punishUser.js";

export const data = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setContexts([InteractionContextType.Guild])
    .addUserOption(opt =>
        opt.setName('target')
            .setDescription('User to ban')
            .setRequired(true)
    )
    .addStringOption(opt =>
        opt.setName('reason')
            .setDescription('Reason for the ban')
            .setRequired(true)
    );

export async function execute(interaction) {
    const target = await interaction.options.getMember('target') ? await interaction.options.getMember('target') : await interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');
    const staffcheck = target instanceof GuildMember ? target.permissions.has(PermissionFlagsBits.ModerateMembers) : null

    if (staffcheck) {
        interaction.reply({
            embeds: [new EmbedBuilder()
                .setAuthor({
                    name: target.user.tag + ' is staff, please handle this with an admin, co-owner, or owner.', iconURL: target.displayAvatarURL({ dynamic: true })
                })
                .setColor('#4b0808')]
            , ephemeral: true
        })
        return;
    }

    if (target.bot)
        return interaction.reply({ content: 'You cannot ban a bot.', ephemeral: true });

    await punishUser({
        interaction: interaction,
        guild: interaction.guild,
        target: target.id,
        moderatorUser: interaction.user,
        reason: reason,
        channel: interaction.channel,
        isAutomated: false,
        currentWarnWeight: 1,
        duration: 0,
        banflag: true,
        buttonflag: false
    });

}