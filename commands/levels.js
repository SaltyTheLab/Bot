import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, InteractionContextType, } from "discord.js";
import { getUser, saveUser } from '../Database/databaseAndFunctions.js';

export const data = new SlashCommandBuilder()
    .setName('add')
    .setDescription('add levels/xp to users')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(command =>
        command.setName('xp').setDescription('add xp to a user')
            .addUserOption(opt => opt.setName('target').setDescription('add xp to a user').setRequired(true))
            .addNumberOption(opt => opt.setName('xp').setDescription('amout of xp to give').setRequired(true))
    )
    .addSubcommand(command =>
        command.setName('levels').setDescription('add levels to a user')
            .addUserOption(opt => opt.setName('target').setDescription('user to add levels to').setRequired(true))
            .addNumberOption(opt => opt.setName('level').setDescription('number of levels').setRequired(true))
    )
    .setContexts(InteractionContextType.Guild)

export async function execute(interaction) {
    const embed = new EmbedBuilder({
        author: { user: interaction.user, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) }
    })
    const target = interaction.options.getUser('target')
    const xp = interaction.options.getNumber('xp') ?? null;
    const level = interaction.options.getNumber('level') ?? null;
    const { userData } = await getUser(target.id, interaction.guild.id, true)
    switch (interaction.options.getSubcommand()) {
        case 'xp': {
            userData.xp += xp
            embed.setDescription(`${xp} xp added to ${target} `)
            break;
        }
        case 'levels': {
            userData.level += level
            embed.setDescription(`${level} levels added to ${target} `)
            break;
        }
    }
    saveUser({ userId: target.id, guildId: interaction.guild.id, userData: userData });
    interaction.reply({
        embeds: [embed]
    })

}
