import { InteractionContextType, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { appealsget } from "../Database/databasefunctions.js";

export const data = new SlashCommandBuilder()
    .setContexts([InteractionContextType.BotDM])
    .setName('appeal')
    .setDescription('Use this command to appeal bans from servers')

export async function execute(interaction) {
    const userbans = await appealsget(interaction.user.id)
    const options = []
    userbans.forEach(ban => {
        const banentry = ban.punishments.filter(p => p.type === 'Ban') ?? null
        const guild = interaction.client.guilds.cache.get(ban.guildId);
        if (banentry.length !== 0) {
            options.push({
                label: guild.name,
                value: guild.id,
                description: `Banned on: ${new Date(ban.punishments.timestamp).toLocaleDateString()}`
            });
        }
    })
    if (options.length == 0)
        return interaction.reply('I could not find any ban records for any servers i am in.')
    const row = new ActionRowBuilder()
        .addComponents(new StringSelectMenuBuilder()
            .setCustomId('guild_appeal_select') // Embed the guild ID in the custom ID
            .setPlaceholder('Select a guild to appeal your ban')
            .addOptions(options)
        )
    await interaction.reply({
        content: `Please select the guild you wish to appeal a ban from:`,
        components: [row],
        withResponse: true
    });
}