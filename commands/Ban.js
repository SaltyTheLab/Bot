import { PermissionFlagsBits, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { logRecentCommand } from "../Logging/recentcommands.js";
export const data = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(opt => opt.setName('target')
        .setDescription('Target user ID')
        .setRequired(true)
    )
    .addStringOption(opt => opt.setName('reason')
        .setDescription('reason')
        .setRequired(true)
    );


export async function execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) { // check for member permission
        return interaction.reply(
            {
                content: 'You do not have permission to use this command.', ephemeral: true
            });
    }
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');

    const commandembed = new EmbedBuilder()  //command embed format
        .setAuthor(
            {
                name: target.id + ' was banned.',
                iconURL: target.displayAvatarURL()
            }
        )
        .setColor(0xFF0000);

    const dmembed = new EmbedBuilder() //dm embed ban format notice 
        .setTitle(`${target.tag}`)
        .setThumbnail(interaction.guild.iconURL())
        .setColor(0xFF0000)
        .setDescription(
            `<@${target.id}>, you have been banned from Salty's Cave. 
            To appeal your ban [click here](https://dyno.gg/form/9dd2f880) which will take you to the appeal link.
        `)
        .setFields({ name: "Reason:", value: `\`${reason}\``, inline: true })
        .setFooter({ text: `${interaction.guild.name}` })
        .setTimestamp();

    const member = await interaction.guild.members.fetch(target.id).catch(() => null); //fetch the users id
    if (!member) // check for user in server
    {
        return interaction.reply({ content: 'User not found.', ephemeral: true });
    }
    let dmstatus = 'User was Dmed.'
    try {
        await target.send({ embeds: [dmembed] });
    }
    catch (err) {
        dmstatus = 'User was not Dmed';
    }
    try { await member.ban() }
    catch {
        return interaction.reply({ content: 'user is already banned.', ephemeral: true })
    }

    //log the ban
    const logembed = new EmbedBuilder()
        .setAuthor({
            name: interaction.user.tag + ' banned a member.',
            iconURL: interaction.user.displayAvatarURL()
        })
        .setColor(0xFF0000)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
            { name: "Target", value: `${target}`, inline: true },
            { name: "Channel", value: `<#${interaction.channel.id}>`, inline: true },
            { name: "Reason", value: `\`${reason}\``, inline: false }
        )
        .setFooter({ text: dmstatus });
    const banlogchannelid = '945821977187328082';
    const banlogchannel = interaction.guild.channels.cache.get(banlogchannelid);
    if (banlogchannel)
        try {
            await banlogchannel.send({ embeds: [logembed] })
        } catch {
            return interaction.reply({ content: 'I can not find my ban logs.', ephemeral: true });
        }
    logRecentCommand(`ban - ${target.tag}] - ${reason}`);
    return interaction.reply({ embeds: [commandembed] });

};