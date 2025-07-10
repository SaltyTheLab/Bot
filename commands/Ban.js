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
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) { // check for member permission
        return interaction.reply(
            {
                content: 'You do not have permission to use this command.', ephemeral: true
            });
    }
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');

    const commandembed = new EmbedBuilder()  //command embed format
        .setAuthor(
            {
                name: target.tag + ' was banned.',
                icon: target.displayAvatarURL()
            }
        )
        .setColor(0xFF0000)

    const dmembed = new EmbedBuilder() //dm format notice 
        .setTitle(`${target.id}`)
        .setDescription(`<@${target.tag}, you have been banned from Salty's Cave for the following reason: ${reason}.
        You may appeal this ban through [here](https://dyno.gg/form/9dd2f880)`)

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (!member) // check for user in server
    {
        return interaction.reply({ content: 'User not found in this server.' })
    }

    await target.send({ embeds: [dmembed] }).catch(() => {
        console.warn(`Unable to DM ${target.tag}`);
    })
    await member.ban();

    return interaction.reply({ embeds: [commandembed] });
};

