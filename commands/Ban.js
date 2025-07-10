import { PermissionFlagsBits, SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(opt => opt.setName('target')
        .setDescription('Target user ID')
        .setRequired(true)
    )
    .addStringOption(opt => opt.setName('reason')
        .setDescription('reason')
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
    const commandembed = new EmbedBuilder() //embed for later use in logging channels
        .setTitle(`${target.displayAvatarURL} ${target.id} was banned`)
        .setColor(0xFF0000)

    const dmembed = new EmbedBuilder()
    .setTitle(`${target.id}`)
    .setDescription(`<@${user.tag}, you have been banned from Salty's Cave for the following reason: ${reason}.
        You may appeal this ban through [here](https://dyno.gg/form/9dd2f880)`)
    await member.ban();

    return interaction.reply({ embeds: [commandembed] });
};

