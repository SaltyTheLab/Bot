import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(opt => opt.setName('target')
        .setDescription('Target user ID')
        .setRequired(true)
    )
    .addStringOption(opt => opt.setName('reason')
        .setDescription('Reason for action')
        .setRequired(true)
    );

export async function execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        return interaction.reply(
            {
                content: 'You do not have permission to use this command.', ephemeral: true
            });
    }
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');
    await member.ban();

    return interaction.reply(`<@${target.id}> was banned.`)
};

