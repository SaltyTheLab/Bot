export async function interactionCreate(interaction) {
  //abort if regular message
  if (!interaction.isChatInputCommand()) return;
  //define command and abort if isn't a valid command
  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) return;

  //attempt to execute the command
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`❌ Error executing command ${interaction.commandName}:`, error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
    } else {
      await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
  }
}
