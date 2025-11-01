import { InteractionContextType, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { getUserForAppeal } from "../Database/databasefunctions.js";

export const data = new SlashCommandBuilder()
    .setContexts([InteractionContextType.BotDM])
    .setName('appeal')
    .setDescription('This command is only for DMs for users who have been banned, do not use in servers.')

export async function execute(interaction) {
    const userbans = await getUserForAppeal(interaction.user.id)
    if (!userbans || userbans.length === 0) {
        return interaction.reply('You do not have any recent ban records with our shared communities.');
    }
    const options = []
    for (const ban of userbans) {
        let banentry = ban.punishments.filter(entry => entry.type === 'Ban')
        if (banentry.length > 0) {
            const guild = interaction.client.guilds.cache.get(ban.guildId);
            if (guild) {
                options.push({
                    label: guild.name,
                    value: guild.id,
                    description: `Banned on: ${new Date(ban.punishments.timestamp).toLocaleDateString()}`
                });
            }
        }
    }
    if (options.length == 0)
        return interaction.reply('I could not find any ban records for any servers i am in.')
    // Create the button
    const row = new ActionRowBuilder()
        .addComponents(new StringSelectMenuBuilder()
            .setCustomId('guild_appeal_select') // Embed the guild ID in the custom ID
            .setPlaceholder('Select a guild to appeal your ban')
            .addOptions(options)
        )
    // Reply with a message containing the button
    await interaction.reply({
        content: `Please select the guild you wish to appeal a ban from:`,
        components: [row],
        fetchReply: true
    });
}
