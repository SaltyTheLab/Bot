import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import guildchannelmap from '../BotListeners/Extravariables/guildconfiguration.json' with {type: 'json'}

export const data = new SlashCommandBuilder()
    .setName('closeapps')
    .setDescription('close the mod applications channel')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

export async function execute(interaction) {
    const channel = interaction.guild.channels.cache.get(guildchannelmap[interaction.guild.id].modChannels.applyChannel)
    const everyone = interaction.guild.roles.everyone;

    if (!channel.permissionsFor(interaction.client.user).has(PermissionFlagsBits.ManageChannels)) {
        return interaction.editReply({
            content: `❌ I do not have the **Manage Channels** permission in ${channel.toString()} to modify its permissions. Please check my role permissions and hierarchy.`,
        });
    }
    try {
        await channel.permissionOverwrites.edit(everyone, {
            ViewChannel: false,
            SendMessages: false
        })
    } catch (err) {
        console.error('Cannot change channel perms:', err)
        interaction.reply({ content: 'I couldn\'t open applications' });
        return;
    }

    interaction.reply({ content: 'Apps have now been closed!' });
}