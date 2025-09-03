import { EmbedBuilder, SlashCommandBuilder, InteractionContextType, PermissionFlagsBits } from "discord.js";
import { getblacklist } from "../Database/databasefunctions.js";

export const data = new SlashCommandBuilder()
    .setName('showblacklist')
    .setDescription('Show a users blacklist')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
        opt.setName('target').setDescription('user to show').setRequired(true)
    )

export async function execute(interaction) {
    const target = interaction.options.getUser('target');
    const guildId = interaction.guild.id;
    const blacklist = await getblacklist(target.id, guildId)
    const list = blacklist.map(role => `<@&${role}>`).join(',')

    const embed = new EmbedBuilder()
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .setDescription(`${target}'s blacklist\n\nblacklist: ${list}`)
    if (list.length == 0)
        embed.setDescription(`${target.tag} blacklist\n\nRoles: empty`)
    interaction.reply({ embeds: [embed] })
}