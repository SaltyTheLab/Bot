import { SlashCommandBuilder, EmbedBuilder, InteractionContextType, PermissionFlagsBits } from "discord.js";
import { getPunishments } from "../Database/databasefunctions.js";

export const data = new SlashCommandBuilder()
    .setName('unwarn')
    .setDescription('removes a users most recent warn')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setContexts(InteractionContextType.Guild)
    .addUserOption(opt =>
        opt.setName('target').setDescription('User to remove warn from').setRequired(true)
    )

export async function execute(interaction) {
    const user = interaction.options.getUser('target')
    const outcome = await getPunishments(user.id, interaction.guild.id, true, true)
    const commandembed = new EmbedBuilder({ description: `recent warn removed from${user}`, color: 0x007800 })
    outcome == 0 ? commandembed
        .setDescription(`No warns removed from${user}`)
        .setColor(0x700202)
        : null
    interaction.reply({
        embeds: [commandembed]
    })
}