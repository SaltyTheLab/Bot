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

    if (member.communicationDisabledUntil) {
        await member.timeout(null)
        return interaction.reply({
            embed: [new EmbedBuilder()
                .setColor(0x00a900)
                .setDescription(
                    `${user.tag} was unmuted.`
                )]
        })
    } else {
        return interaction.reply({
            embed: [new EmbedBuilder()
                .setColor(0xFF5a00)
                .setDescription(
                    `${user.tag} is not muted.`
                )]
        })
    }
}