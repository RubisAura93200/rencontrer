// src/deploy-commands.js
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
  } else {
    console.warn(`[WARNING] La commande ${file} est invalide (manque data ou execute).`);
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`⏳ Début du déploiement de ${commands.length} commandes slash...`);

    // Enregistrer les commandes uniquement dans un serveur (GUILD_ID) pour le dev/test
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands },
    );

    console.log('✅ Commandes enregistrées avec succès.');
  } catch (error) {
    console.error('❌ Erreur lors du déploiement des commandes :', error);
  }
})();
