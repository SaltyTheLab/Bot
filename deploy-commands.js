import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { data as pingData } from './commands/ping.js';

config();

const commands = [pingData.toJSON()];
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('Slash commands registered!');
  } catch (error) {
    console.error(error);
  }
})();
