// src/utils/embeds.js
const { EmbedBuilder } = require('discord.js');

function createProfileEmbed(profile, user) {
  const fields = [];

  // quelques champs en inline
  fields.push({ name: 'Âge', value: String(profile.age ?? 'Non défini'), inline: true });
  fields.push({ name: 'Genre', value: profile.genre ?? 'Non défini', inline: true });
  fields.push({ name: 'Orientation', value: profile.orientation ?? 'Non défini', inline: true });
  fields.push({ name: 'Position', value: profile.position ?? 'Non défini', inline: true });
  fields.push({ name: 'Fumeur', value: profile.fumeur ?? 'Non défini', inline: true });
  fields.push({ name: 'Alcool', value: profile.alcool ?? 'Non défini', inline: true });

  // les autres en full width
  fields.push({ name: 'Recherche', value: profile.recherche ?? 'Non défini', inline: false });
  fields.push({ name: 'Localisation', value: profile.localisation ?? 'Non défini', inline: false });
  fields.push({ name: "Centres d'intérêt", value: profile.interets ?? 'Non défini', inline: false });
  fields.push({ name: 'Présentation', value: profile.bio ?? 'Non défini', inline: false });

  // likes
  fields.push({ name: 'Likes', value: String(profile.likes ?? 0), inline: true });

  const embed = new EmbedBuilder()
    .setTitle(`👤 Profil — ${user.username}`)
    .setThumbnail(profile.photo || user.displayAvatarURL?.() || null)
    .addFields(fields)
    .setColor(0x00AEFF)
    .setFooter({ text: `ID: ${user.id}` })
    .setTimestamp(profile.created_at ? new Date(profile.created_at) : new Date());

  return embed;
}

module.exports = { createProfileEmbed };
