import { put } from './rest'
import { ApplicationCommandOptionType, ApplicationCommandType, InteractionContextType, PermissionFlagsBits, type RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord-api-types/v10';
const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [
    {
        name: 'appeal',
        description: 'appeal a ban',
        contexts: [InteractionContextType.Guild], // Instead of [0]
        type: ApplicationCommandType.ChatInput // Instead of 1
    },
    {
        name: 'applications',
        description: 'Open/close applications',
        contexts: [InteractionContextType.Guild],
        default_member_permissions: String(PermissionFlagsBits.Administrator),
        options: [
            { name: 'open', description: 'Open applications', type: ApplicationCommandOptionType.Subcommand },
            { name: 'close', description: 'Close Applications', type: ApplicationCommandOptionType.Subcommand }
        ]
    },
    {
        name: 'apply',
        description: 'Apply to be on the mod team',
        type: ApplicationCommandType.ChatInput
    },
    {
        name: 'blacklist',
        description: 'edit/show a users blacklist',
        contexts: [InteractionContextType.Guild],
        default_member_permissions: String(PermissionFlagsBits.ModerateMembers),
        options: [
            {
                name: 'add',
                description: 'add a role ',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    { name: 'target', description: 'User', required: true, type: ApplicationCommandOptionType.User },
                    { name: 'role', description: 'role', required: true, type: ApplicationCommandOptionType.Role }
                ]
            },
            {
                name: 'show',
                description: 'show blacklist',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    { name: 'target', description: 'user to show', required: true, type: ApplicationCommandOptionType.User }
                ]
            },
            {
                name: 'remove',
                description: 'remove a role',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    { name: 'target', description: 'User', required: true, type: ApplicationCommandOptionType.User },
                    { name: 'role', description: 'Role', required: true, type: ApplicationCommandOptionType.Role }
                ]
            }
        ]
    },
    {
        name: 'dnd',
        description: 'Roll DND dice',
        contexts: [InteractionContextType.Guild],
        options: [
            { name: 'd4', description: 'Roll a D4', type: ApplicationCommandOptionType.Subcommand },
            { name: 'd6', description: 'Roll a D6', type: ApplicationCommandOptionType.Subcommand },
            { name: 'd8', description: 'Roll a D8', type: ApplicationCommandOptionType.Subcommand },
            { name: 'd10', description: 'Roll a D10', type: ApplicationCommandOptionType.Subcommand },
            { name: 'd12', description: 'Roll a D12', type: ApplicationCommandOptionType.Subcommand },
            { name: 'd20', description: 'Roll a D20', type: ApplicationCommandOptionType.Subcommand },
            { name: 'd100', description: 'Roll a D100', type: ApplicationCommandOptionType.Subcommand }
        ]
    },
    {
        name: 'games',
        description: 'Play a game',
        type: ApplicationCommandType.ChatInput,
        contexts: [InteractionContextType.Guild],
        options: [
            {
                name: 'tictactoe',
                description: 'Play Tictactoe',
                type: ApplicationCommandOptionType.Subcommand,
                options: [{ name: 'opponent', description: 'Your Opponent', required: true, type: ApplicationCommandOptionType.User }]
            },
            {
                name: 'rps',
                description: 'Play Rock, Paper, Scissors',
                type: ApplicationCommandOptionType.Subcommand,
                options: [{
                    name: 'choice',
                    description: 'Your move',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: 'Rock', value: 'rock' },
                        { name: 'Paper', value: 'paper' },
                        { name: 'Scissors', value: 'scissors' }
                    ]
                }]
            },
            { name: 'logos', description: 'Play the Logo Game', type: ApplicationCommandOptionType.Subcommand },
            {
                name: 'bet',
                description: 'bet coins',
                type: ApplicationCommandOptionType.Subcommand,
                options: [{ name: 'amount', description: 'The amount', required: true, type: ApplicationCommandOptionType.Integer }]
            },
            { name: 'highlow', description: 'Guess a number between 1 and 100', type: ApplicationCommandOptionType.Subcommand }
        ]
    },
    { name: 'leaderboard', type: ApplicationCommandType.ChatInput, description: 'Show the top ten users', contexts: [InteractionContextType.Guild] },
    {
        name: 'member',
        description: 'Warn/Mute/Ban/kick/unwarn/unmute a user',
        default_member_permissions: String(PermissionFlagsBits.ModerateMembers),
        contexts: [InteractionContextType.Guild],
        options: [
            {
                name: 'warn',
                description: 'Warn a user',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    { name: 'target', description: 'The user', required: true, type: ApplicationCommandOptionType.User },
                    { name: 'reason', description: 'The reason', required: true, type: ApplicationCommandOptionType.String }
                ]
            },
            {
                name: 'mute',
                description: 'Mute a user',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    { name: 'target', description: 'The user', required: true, type: ApplicationCommandOptionType.User },
                    { name: 'reason', description: 'Reason', required: true, type: ApplicationCommandOptionType.String },
                    { name: 'duration', description: 'Duration', required: true, type: ApplicationCommandOptionType.Integer },
                    {
                        name: 'unit',
                        description: 'Unit',
                        required: true,
                        type: ApplicationCommandOptionType.String,
                        choices: [
                            { name: 'Minute', value: 'min' },
                            { name: 'Hour', value: 'hour' },
                            { name: 'Day', value: 'day' }
                        ]
                    }
                ]
            },
            {
                name: 'ban',
                description: 'Ban a user',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    { name: 'target', description: 'The user', required: true, type: ApplicationCommandOptionType.User },
                    { name: 'reason', description: 'Reason', required: true, type: ApplicationCommandOptionType.String }
                ]
            },
            {
                name: 'kick',
                description: 'Kick a user',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    { name: 'target', description: 'The user', required: true, type: ApplicationCommandOptionType.User },
                    { name: 'reason', description: 'Reason', required: true, type: ApplicationCommandOptionType.String }
                ]
            },
            {
                name: 'unwarn',
                description: "Removes a user's warn",
                type: ApplicationCommandOptionType.Subcommand,
                options: [{ name: 'target', description: 'The User', required: true, type: ApplicationCommandOptionType.User }]
            },
            {
                name: 'unmute',
                description: 'Unmute a user',
                type: ApplicationCommandOptionType.Subcommand,
                options: [{ name: 'target', description: 'The User', required: true, type: ApplicationCommandOptionType.User }]
            }
        ]
    },
    {
        name: 'modlogs',
        description: 'View a user\'s moderation history.',
        default_member_permissions: String(PermissionFlagsBits.ModerateMembers),
        contexts: [InteractionContextType.Guild],
        options: [{ name: 'target', description: 'The user to view', required: true, type: ApplicationCommandOptionType.User }]
    },
    {
        name: 'note',
        description: "add/show a user's notes",
        default_member_permissions: String(PermissionFlagsBits.ModerateMembers),
        contexts: [InteractionContextType.Guild],
        options: [
            {
                name: 'show',
                description: 'Display a users notes',
                type: ApplicationCommandOptionType.Subcommand,
                options: [{ name: 'target', description: 'target User', required: true, type: ApplicationCommandOptionType.User }]
            },
            {
                name: 'add',
                description: 'Add note to a user',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    { name: 'target', description: 'The User', required: true, type: ApplicationCommandOptionType.User },
                    { name: 'note', description: 'note to add', required: true, type: ApplicationCommandOptionType.String }
                ]
            }
        ]
    },
    {
        name: 'rank',
        description: 'See your xp and Level',
        contexts: [InteractionContextType.Guild],
        type: ApplicationCommandType.ChatInput,
        options: [{ name: 'member', description: 'The Member', type: ApplicationCommandOptionType.User }]
    },
    {
        name: 'refresh',
        description: 'Refreshes the Posted embeds',
        default_member_permissions: String(PermissionFlagsBits.Administrator),
        contexts: [InteractionContextType.Guild]
    }
];
async function updatecommands() {
    console.log(await put(`applications/1420927654701301951/commands`, commands));
}
updatecommands()