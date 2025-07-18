import { PermissionFlagsBits, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { logRecentCommand } from "../Logging/recentcommands.js";
import { banlogChannelid } from "../BotListeners/channelids.js";

export const data = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
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
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');

    if (!target) {
        return interaction.reply({ content: '⚠️ User not found.', ephemeral: true });
    }

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member) {
        return interaction.reply({ content: '⚠️ This user is not in the server.', ephemeral: true });
    }

    // Prepare embeds
    const dmEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${target.tag}`)
        .setThumbnail(interaction.guild.iconURL())
        .setDescription(
            `<@${target.id}>, you have been **banned** from **Salty's Cave**.\n\n` +
            `Please [click here](https://dyno.gg/form/9dd2f880) to appeal.`
        )
        .addFields({ name: 'Reason:', value: `\`${reason}\`` })
        .setFooter({ text: interaction.guild.name })
        .setTimestamp();

    const commandEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setAuthor({ name: `${target.tag} was banned.`, iconURL: target.displayAvatarURL() });

    const logEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setAuthor({ name: `${interaction.user.tag} banned a member`, iconURL: interaction.user.displayAvatarURL() })
        .setThumbnail(target.displayAvatarURL())
        .addFields(
            { name: 'Target:', value: `${target}`, inline: true },
            { name: 'Channel:', value: `<#${interaction.channel.id}>`, inline: true },
            { name: 'Reason:', value: `\`${reason}\``, inline: false }
        )
        .setTimestamp();

    // Attempt to DM the user
    let dmStatus = '✅ User was DMed.';
    try {
        await target.send({ embeds: [dmEmbed] });
    } catch {
        dmStatus = '⚠️ Could not DM the user.';
    }

    // Attempt the ban
    try {
        await member.ban({ reason: `Issued by ${interaction.user.tag}: ${reason}` });
    } catch (err) {
        return interaction.reply({ content: '❌ I failed to ban this user. Make sure my role is higher.', ephemeral: true });
    }

    logEmbed.setFooter({ text: dmStatus });

    // Log the action
    const banLogChannel = interaction.guild.channels.cache.get(banlogChannelid);
    if (banLogChannel) {
        try {
            await banLogChannel.send({ embeds: [logEmbed] });
        } catch (err) {
            console.warn('⚠️ Failed to send ban log:', err);
        }
    }

    // Log to recent command system
    logRecentCommand(`ban - ${target.tag} - ${reason} - issuer: ${interaction.user.tag}`);

    return interaction.reply({ embeds: [commandEmbed] });
}