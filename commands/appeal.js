import { InteractionContextType, ApplicationCommandType, LabelBuilder, ModalBuilder, ContextMenuCommandBuilder } from "discord.js";
import { appealsget } from '../Database/databaseAndFunctions.js';

export const data = new ContextMenuCommandBuilder()
    .setName('Appeal')
    .setType(ApplicationCommandType.User)
    .setContexts([InteractionContextType.BotDM])

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
    if (options.length == 0) return interaction.reply('I could not find any ban records for any servers i am in.')
    const guildid = new LabelBuilder({ label: "Guild ID", component: { type: 3, custom_id: 'guildId', max_values: 1, options: options } })
    const reason = new LabelBuilder({ label: "Why were you banned?", component: { type: 4, custom_id: 'reason', style: 2, required: true } })
    const justification = new LabelBuilder({ label: "Why should we accept your appeal?", component: { type: 4, custom_id: 'justification', style: 2, required: true } })
    const extra = new LabelBuilder({ label: 'Anything else we need to know?', component: { type: 4, custom_id: 'extra', style: 2, required: false } })
    interaction.showModal(new ModalBuilder({ custom_id: 'appealModal', title: 'Ban Appeal Submission', components: [guildid, reason, justification, extra] }));
}