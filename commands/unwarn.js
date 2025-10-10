import { SlashCommandBuilder, EmbedBuilder, InteractionContextType, PermissionFlagsBits } from "discord.js";
import { unwarn } from "../Database/databasefunctions.js";

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
    const guildId = interaction.guild.id;
    await unwarn(user.id, guildId);

    const commandembed = new EmbedBuilder()
        .setDescription(`recent warn removed from${user}`)
        .setColor(0x007800)
    interaction.reply({
        embeds: [commandembed]
    })
}