import { PermissionFlagsBits, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { warnUser } from '../utilities/warnUser.js';



export const data = new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warns a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
        opt.setName('target')
            .setDescription('Target user to warn')
            .setRequired(true)
    )
    .addStringOption(opt =>
        opt.setName('reason')
            .setDescription('Reason for the warning')
            .setRequired(true)
    );

export async function execute(interaction) {
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');
    const issuer = interaction.user;
    const channel = interaction.channel;

    if (!target) {
        return interaction.reply({ content: '⚠️ Could not find the user.', ephemeral: true });
    }

    if (target.bot) {
        return interaction.reply({ content: '⚠️ You cannot warn bots.', ephemeral: true });
    }

    if (target.id === issuer.id) {
        return interaction.reply({ content: '⚠️ You cannot warn yourself.', ephemeral: true });
    }

    //run through relevent helper command function
    const output = await warnUser({
        guild: interaction.guild,
        targetUser: target,
        moderatorUser: issuer,
        reason,
        channel: channel.id,
        isautomated: false
    });

    if (typeof output === 'string') {
        return interaction.reply({ content: output });
    } else
        return interaction.reply({ embeds: [output] });

}