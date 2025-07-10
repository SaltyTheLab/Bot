import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(opt => opt.setName('Target')
        .setDescription('Target user ID')
        .setRequired(true)
    )
    .addStringOption(opt => opt.setName('reason')
        .setDescription('Reason for action')
        .setRequired(true)
    );

