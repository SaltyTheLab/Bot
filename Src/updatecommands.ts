import { REST, InteractionContextType, PermissionFlagsBits, Routes, SlashCommandBuilder, SlashCommandStringOption, SlashCommandSubcommandBuilder, SlashCommandUserOption, SlashCommandRoleOption, type RESTPostAPIChatInputApplicationCommandsJSONBody, SlashCommandIntegerOption } from 'discord.js'
const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [
    new SlashCommandBuilder()
        .setName('appeal')
        .setDescription('appeal a ban')
        .setContexts([InteractionContextType.Guild]).toJSON(),
    new SlashCommandBuilder()
        .setName('applications')
        .setDescription('Open/close applications')
        .setContexts([InteractionContextType.Guild])
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(new SlashCommandStringOption()
            .setName('decision')
            .setDescription('open or close apps')
            .setChoices([{ name: 'open', value: 'open' }, { name: 'close', value: 'close' }])
        ).toJSON(),
    new SlashCommandBuilder()
        .setName('apply')
        .setContexts([InteractionContextType.Guild])
        .setDescription('Apply to be on the mod team'
        ).toJSON(),
    new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('edit/show a users blacklist')
        .setContexts([InteractionContextType.Guild])
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('modify')
                .setDescription('modify a user\'s blacklist')
                .addStringOption(new SlashCommandStringOption().setName('action').setDescription('the action').setRequired(true)
                    .addChoices([{ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' }])
                )
                .addUserOption(new SlashCommandUserOption().setName('target').setDescription('User').setRequired(true))
                .addRoleOption(new SlashCommandRoleOption().setName('role').setDescription('Role').setRequired(true))
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder().setName('show').setDescription('show blacklist').addUserOption(new SlashCommandUserOption().setName('target').setDescription('User to Show').setRequired(true))
        ).toJSON(),
    new SlashCommandBuilder()
        .setName('dnd')
        .setDescription('Roll DND dice')
        .setContexts([InteractionContextType.Guild])
        .addStringOption(
            new SlashCommandStringOption().setName('sides').setRequired(true).setDescription('number of sides')
                .setChoices([
                    { name: '4', value: '4' },
                    { name: '6', value: '6' },
                    { name: '8', value: '8' },
                    { name: '10', value: '10' },
                    { name: '12', value: '12' },
                    { name: '20', value: '20' },
                    { name: '100', value: '100' }
                ])
        )
        .toJSON(),
    new SlashCommandBuilder()
        .setName('games')
        .setDescription('Play a game')
        .setContexts([InteractionContextType.Guild])
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('tictactoe')
                .setDescription('Play Tictactoe')
                .addUserOption(new SlashCommandUserOption().setName('opponent').setDescription('Your Opponent').setRequired(true))
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('rps')
                .setDescription('Play Rock, Paper, Scissors')
                .addStringOption(
                    new SlashCommandStringOption().setName('choice').setDescription('Your move').setRequired(true).setChoices([{ name: 'Rock', value: 'rock' }, { name: 'Paper', value: 'paper' }, { name: 'Scissors', value: 'scissors' }])
                )
        )
        .addSubcommand(new SlashCommandSubcommandBuilder().setName('logos').setDescription('Play the logo game'))
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('bet')
                .setDescription('Bet coins')
                .addIntegerOption(new SlashCommandIntegerOption().setName('amount').setDescription('The amount').setRequired(true))
        )
        .addSubcommand(new SlashCommandSubcommandBuilder().setName('highlow').setDescription('Guess a number between 1 and 100'))
        .toJSON(),
    new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Show the top ten users')
        .setContexts([InteractionContextType.Guild])
        .toJSON(),
    new SlashCommandBuilder()
        .setName('member')
        .setDescription('Warn/Mute/Ban/kick/unwarn/unmute a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('create')
                .setDescription('Create a missing database record')
                .addUserOption(new SlashCommandUserOption().setName('target').setDescription('The member').setRequired(true))
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('warn')
                .setDescription('Warn a user')
                .addUserOption(new SlashCommandUserOption().setName('target').setDescription('The user').setRequired(true))
                .addStringOption(new SlashCommandStringOption().setName('reason').setDescription('The reason').setRequired(true))
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('mute')
                .setDescription('Mute a user')
                .addUserOption(new SlashCommandUserOption().setName('target').setDescription('The user').setRequired(true))
                .addStringOption(new SlashCommandStringOption().setName('reason').setDescription('Reason').setRequired(true))
                .addIntegerOption(new SlashCommandIntegerOption().setName('duration').setDescription('Unit').setRequired(true))
                .addStringOption(
                    new SlashCommandStringOption().setName('unit').setDescription('Unit').setRequired(true).setChoices([{ name: 'Minute', value: 'min' }, { name: 'Hour', value: 'hour' }, { name: 'Day', value: 'day' }])
                )
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('ban')
                .setDescription('Ban a user')
                .addUserOption(new SlashCommandUserOption().setName('target').setDescription('The user').setRequired(true))
                .addStringOption(new SlashCommandStringOption().setName('reason').setDescription('Reason').setRequired(true))
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('kick')
                .setDescription('Kick a user')
                .addUserOption(new SlashCommandUserOption().setName('target').setDescription('The user').setRequired(true))
                .addStringOption(new SlashCommandStringOption().setName('reason').setDescription('Reason').setRequired(true))
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('unwarn')
                .setDescription("Removes a user's warn")
                .addUserOption(new SlashCommandUserOption().setName('target').setDescription('The User').setRequired(true))
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('unmute')
                .setDescription('Unmute a user')
                .addUserOption(
                    new SlashCommandUserOption()
                        .setName('target')
                        .setDescription('The User')
                        .setRequired(true)
                )
        )
        .toJSON(),
    new SlashCommandBuilder()
        .setName('modlogs')
        .setDescription('View a user\'s moderation history.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setContexts(InteractionContextType.Guild)
        .addUserOption(new SlashCommandUserOption().setName('target').setDescription('The user to view').setRequired(true))
        .toJSON(),
    new SlashCommandBuilder()
        .setName('note')
        .setDescription("add/show a user's notes")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('show')
                .setDescription('Display a users notes')
                .addUserOption(new SlashCommandUserOption().setName('target').setDescription('Target User').setRequired(true))
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('add')
                .setDescription('Add note to a user')
                .addUserOption(new SlashCommandUserOption().setName('target').setDescription('The User').setRequired(true))
                .addStringOption(new SlashCommandStringOption().setName('note').setDescription('note to add').setRequired(true))
        )
        .toJSON(),
    new SlashCommandBuilder()
        .setName('rank')
        .setDescription('view a users xp and Level')
        .setContexts(InteractionContextType.Guild)
        .addUserOption(new SlashCommandUserOption().setName('target').setDescription('The Member'))
        .toJSON(),
    new SlashCommandBuilder()
        .setName('link')
        .setDescription('Link your twitch')
        .setContexts(InteractionContextType.Guild)
        .addStringOption(
            new SlashCommandStringOption()
                .setName('channel')
                .setDescription('Twitch channel to link')
                .setRequired(true)
        )
        .toJSON(),
    new SlashCommandBuilder()
        .setName('admin')
        .setDescription('all admin commands')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName('clear')
                .setDescription('clear a number of messages')
                .addIntegerOption(
                    new SlashCommandIntegerOption()
                        .setName('count')
                        .setDescription('number of messages to clear')
                        .setRequired(true)
                        .setMinValue(2)
                        .setMaxValue(100)
                )
        )
        .toJSON(),
];
const rest = new REST().setToken(`${Bun.env.TOKEN}`)
async function updatecommands() { console.log(await rest.put(Routes.applicationCommands('1420927654701301951'), { body: commands })); }
await updatecommands()