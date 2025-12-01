import { InteractionContextType, SlashCommandBuilder, LabelBuilder, ModalBuilder, TextInputStyle } from "discord.js";
import { appealsget } from '../Database/databaseAndFunctions.js';

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
    const guildid = new LabelBuilder({
        label: "Guild ID",
        component: { type: 3, custom_id: 'guildId', max_values: 1, options: options }
    })
    const reason = new LabelBuilder({
        label: "Why were you banned?",
        component: { type: 4, custom_id: 'reason', style: TextInputStyle.Paragraph, required: true, placeholder: 'Put your ban reason here' }
    })
    const justification = new LabelBuilder({
        label: "Why should accept your ban appeal?",
        component: { type: 4, custom_id: 'justification', style: TextInputStyle.Paragraph, required: true, placeholder: 'Put your explaination here' }
    })
    const extra = new LabelBuilder({
        label: 'Anything else we need to know?',
        component: { type: 4, custom_id: 'extra', style: TextInputStyle.Paragraph, required: false, placeholder: 'Put anything else here' }
    })
    interaction.showModal(new ModalBuilder({
        custom_id: 'appealModal',
        title: 'Ban Appeal Submission',
        components: [guildid, reason, justification, extra]
    }));
}