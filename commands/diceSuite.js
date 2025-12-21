function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
export default {
    data: {
        name: 'dnd', description: 'Roll DND dice', contexts: 0,
        options: [
            { name: 'd4', description: 'Roll a D4', type: 1 },
            { name: 'd6', description: 'Roll a D6', type: 1 },
            { name: 'd8', description: 'Roll a D8', type: 1 },
            { name: 'd10', description: 'Roll a D10', type: 1 },
            { name: 'd12', description: 'Roll a D12', type: 1 },
            { name: 'd20', description: 'Roll a D20', type: 1 },
            { name: 'd100', description: 'Roll a D100', type: 1 }
        ],
    },
    async execute({ interaction, api }) {
        let numbers;
        const subcommand = interaction.data.options[0];
        switch (subcommand.name) {
            case 'd4': numbers = [1, 2, 3, 4];
                break;
            case 'd6': numbers = [1, 2, 3, 4, 5, 6];
                break;
            case 'd8': numbers = [1, 2, 3, 4, 5, 6, 7, 8];
                break;
            case 'd10': numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
                break;
            case 'd12': numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
                break;
            case 'd20': numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
                break;
            case 'd100': numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 821, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100];
        }
        const shuffled = shuffle(numbers);
        return await api.interactions.Reply(interaction.application_id, interaction.token, { content: `you rolled a ${shuffled[Math.floor(Math.random() * numbers.length)]}` })
    }
}
