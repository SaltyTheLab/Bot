import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, InteractionContextType, } from "discord.js";
import { getUser, saveUser } from "../Database/databasefunctions.js";

export const data = new SlashCommandBuilder()
    .setName('add')
    .setDescription('add levels/xp to users')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(command =>
        command.setName('xp').setDescription('add xp to a user')
            .addUserOption(opt =>
                opt.setName('target').setDescription('add xp to a user').setRequired(true)
            )
            .addNumberOption(opt =>
                opt.setName('xp').setDescription('amout of xp to give').setRequired(true)
            )
    )
    .addSubcommand(command =>
        command.setName('levels').setDescription('add levels to a user')
            .addUserOption(opt =>
                opt.setName('target').setDescription('user to add levels to').setRequired(true)
            )
            .addNumberOption(opt =>
                opt.setName('level').setDescription('number of levels').setRequired(true)
            )
    )
    .setContexts(InteractionContextType.Guild)

export async function execute(interaction) {
    const embed = new EmbedBuilder()
        .setAuthor({ user: interaction.user, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
    const command = interaction.options.getSubcommand();
    const target = interaction.options.getUser('target')
    const { userData } = await getUser(target.id, interaction.guild.id)
    switch (command) {
        case 'xp': {
            const xp = interaction.options.getNumber('xp')
            userData.xp += xp
            embed.setDescription(`${xp} xp added to ${target} `)
            break;
        }
        case 'levels': {
            const level = interaction.options.getNumber('level')
            userData.level += level
            embed.setDescription(`${level} levels added to ${target} `)
            break;
        }
    }
    await saveUser(target.id, interaction.guild.id, { userData });
    await interaction.reply({
        embeds: [embed]
    })

}
