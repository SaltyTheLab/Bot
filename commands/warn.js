import { PermissionFlagsBits, SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warns a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName('target')
        .setDescription('Target user ID')
        .setRequired(true)
    )
    .addStringOption(opt => opt.setName('reason')
        .setDescription('reason')
        .setRequired(true)
    );
export async function execute(interaction) {
    const target = interaction.options.getUser('target')
    const reason = interaction.options.getString('reason')
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({
            content: 'you do not have permission to use this command.'
        });
    }
    const commandembed = new EmbedBuilder()
        .setAuthor({
            name: target.tag + `was issued a warning`,
            icon: target.displayAvatarURL()

        })
    return interaction.replay({ embed: [commandembed] })
}