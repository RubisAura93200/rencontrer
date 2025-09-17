const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/db');
const { logProfile } = require('../utils/logger');


module.exports = {
data: new SlashCommandBuilder()
.setName('modifierprofil')
.setDescription('Modifier votre profil')
.addStringOption(option =>
option.setName('bio').setDescription('Nouvelle bio').setRequired(true)
),


async execute(interaction) {
const bio = interaction.options.getString('bio');
const userId = interaction.user.id;
const now = Date.now();


const existing = db.prepare('SELECT * FROM profiles WHERE userId = ?').get(userId);
if (!existing) {
return interaction.reply({ content: "Vous n'avez pas de profil. Utilisez /profil pour en créer un.", ephemeral: true });
}


db.prepare('UPDATE profiles SET bio = ?, username = ?, created_at = ? WHERE userId = ?')
.run(bio, interaction.user.tag, now, userId);


await interaction.reply({ content: 'Profil modifié ✅', ephemeral: true });


try { await logProfile(interaction.client, `${interaction.user.tag} a modifié son profil`); } catch (e) { /* ignore logger errors */ }
},
};