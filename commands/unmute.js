import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmutes a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
        opt.setName('target').setDescription('User to unmute').setRequired(true))

export async function execute(interaction) {
    const user = interaction.options.getUser('target');
    const member = await interaction.guild.members.fetch(user.id);
    const embed = new EmbedBuilder()
        .setColor(0xb50000)
        .setDescription(`${user} is not muted.`)

    if (member.communicationDisabledUntil) {
        await member.timeout(null)
        embed.setColor(0x00a900)
        embed.setDescription(
            `${user.tag} was unmuted.`
        )
        return interaction.reply({
            embeds: [embed]
        })
    } else {
        return interaction.reply({
            embeds: [embed]
        })
    }
}