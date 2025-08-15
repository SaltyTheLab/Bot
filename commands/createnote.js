import { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { addNote } from "../Database/databasefunctions.js";

export const data = new SlashCommandBuilder()
    .setName('addnote')
    .setDescription('Adds a note to a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
        opt.setName('target').setDescription('Target user to add note to').setRequired(true)
    )
    .addStringOption(opt =>
        opt.setName('note').setDescription('note to add').setRequired(true)
    )
export async function execute(interaction) {
    const target = interaction.options.getUser('target')
    const note = interaction.options.getString('note')
    const moderator = interaction.user;
    const guildId = interaction.guild.id

    addNote({ userId: target.id, moderatorId: moderator.id, note: note, guildId: guildId })

    const commandembed = new EmbedBuilder()
        .setColor(0x00a900)
        .setDescription([
            `📝 note created for <@${target.id}>\n`,
            ` > ${note}`
        ].join('\n\n'))

    interaction.reply({
        embeds: [commandembed]
    })
}