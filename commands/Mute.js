import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { logRecentCommand } from "../recentcommands.js";

export const data = new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName('target')
        .setDescription('Target user ID')
        .setRequired(true)
    )
    .addStringOption(opt => opt.setName('reason')
        .setDescription('Reason for action')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
        opt.setName('duration')
            .setDescription('How long to mute')
            .setRequired(true)
    )
    .addStringOption(opt =>
        opt.setName('unit')
            .setDescription('Duration units')
            .setRequired(true)
            .addChoices(
                { name: 'Minutes', value: 'm' },
                { name: 'Hours', value: 'h' },
                { name: 'Days', value: 'd' }
            )
    );
export async function execute(interaction) {
    let mutecounter = 0;
    //check if permissions are present.
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({
            content: 'You do not have permission to use this command.',
            ephemeral: true
        })
    }
    //fetch the values entered into the command
    let dmstatus = 'User was dmed.';
    const target = interaction.options.getUser('target');
    const duration = interaction.options.getInteger('duration');
    const unit = interaction.options.getString('unit');
    const reason = interaction.options.getString('reason');
    const unitMap = {
        m: 60000,    // minutes
        h: 3600000,  // hours
        d: 86400000  // days
    };
    const timeMs = duration * unitMap[unit]; // map days, hours, minutes to milliseconds
    //embed for commands
    const commandembed = new EmbedBuilder()
        .setAuthor({
            name: `${target.tag} was issued a ${duration}${unit} mute.`,
            iconURL: target.displayAvatarURL({ dynamic: true })
        })
        .setColor(0xffa500)

    //embed for user dm
    const dmembed = new EmbedBuilder()
        .setAuthor({
            name: `${target.tag} was issued a 1m mute.`,
            iconURL: target.displayAvatarURL({ dynamic: true })
        })
        .setColor(0xffa500) //orange
        .setThumbnail(interaction.guild.iconURL())
        .setDescription(`<@${target.id}>, you have been issued a ` + `\`${duration} ${unit} mute\`` + ` in Salty's Cave.`)
        .addFields(
            { name: 'Reason:', value: `\`${reason}\``, inline: false },
        )
        .setTimestamp();


    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (!timeMs || timeMs <= 0)
        return interaction.reply({ content: 'Invalid duration.', ephemeral: true });

    //check if user is in the server
    if (!member)
        return interaction.reply({ content: 'user not found.', ephemeral: true });


    //apply the timeout

    if (!member.communicationDisabledUntilTimestop) {
        try {
            await member.timeout(timeMs, reason);
        }
        catch (err) {
            return interaction.reply({ content: '⚠️ Failed to apply mute.', ephemeral: true });
        }
    } else return interaction.reply({ content: 'User already has a applied timeout.', ephemeral: true })
    //attempt to dm the user
    try {
        await target.send({ embeds: [dmembed] })
    }
    catch {
        dmstatus = 'user was not dmed.'
    }
    //build the log embed.
    const logembed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setThumbnail(target.displayAvatarURL())
        .setAuthor({
            name: interaction.user.tag + ` muted a member`,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true })
        })
        .setFields(
            { name: 'Target:', value: `${target}`, inline: true },
            { name: 'Channel:', value: `<#${interaction.channel.id}>`, inline: true },
            { name: 'Reason:', value: `\`${reason}\``, inline: false }
        )
        .setFooter({ text: dmstatus })

    //log the action in the mute logs channel.
    const logchannelid = '1392889476686020700';
    const logchannel = interaction.guild.channels.cache.get(logchannelid);
    if (!logchannel) {
        return interaction.reply({ content: 'You are missing the channel id', ephemeral: true })
    } else
        try {
            await logchannel.send({ embeds: [logembed] });
        } catch {
            return interaction.reply({ content: 'I could not find my logs channel.', ephemeral: true });
        }
    mutecounter++;
    logRecentCommand(`mute [${mutecounter}] - ${target.tag} - ${duration} - ${reason} `)
    return interaction.reply({ embeds: [commandembed] });
};
