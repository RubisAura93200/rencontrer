const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const db = require('../utils/db');
const { createProfileEmbed } = require('../utils/embeds');
const { logInfo, logCritical } = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('forcerprofil')
    .setDescription('Poster un profil manuellement dans le salon de rencontre (admin/mod)')
    .addUserOption(opt => opt.setName('user').setDescription('Utilisateur cible').setRequired(true)),

  async execute(interaction) {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isMod =
      member.permissions.has(PermissionsBitField.Flags.Administrator) ||
      member.roles.cache.has(process.env.ADMIN_ROLE_ID) ||
      member.roles.cache.has(process.env.MODERATOR_ROLE_ID) ||
      interaction.user.id === interaction.guild.ownerId;

    if (!isMod) {
      return interaction.reply({ content: 'Permission refusée.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const profile = db.prepare('SELECT * FROM profiles WHERE userId = ?').get(target.id);
    if (!profile) {
      return interaction.reply({ content: "Cet utilisateur n'a pas de profil.", ephemeral: true });
    }

    // Ensure settings table exists (pour stocker current message id)
    db.prepare('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)').run();
    const getSetting = k => {
      const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(k);
      return r ? r.value : null;
    };
    const setSetting = (k, v) =>
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)').run(k, String(v));

    // Récupérer le salon de rencontre
    const datingChannelId = process.env.DATING_CHANNEL_ID;
    if (!datingChannelId) {
      return interaction.reply({ content: 'DATING_CHANNEL_ID non configuré dans .env', ephemeral: true });
    }

    const channel =
      interaction.client.channels.cache.get(datingChannelId) ||
      (await interaction.client.channels.fetch(datingChannelId).catch(() => null));

    if (!channel) {
      return interaction.reply({
        content: 'Salon de rencontre introuvable. Vérifie DATING_CHANNEL_ID.',
        ephemeral: true,
      });
    }

    // Supprimer le message précédent (s'il existe)
    try {
      const prevId = getSetting('current_profile_message_id');
      if (prevId) {
        const prevMsg = await channel.messages.fetch(prevId).catch(() => null);
        if (prevMsg) await prevMsg.delete().catch(() => {});
      }
    } catch (e) {
      try {
        await logCritical(interaction.client, `Erreur suppression message précédent: ${e.message}`);
      } catch (e) {}
    }

    // Créer les boutons
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`like_${profile.userId}`).setLabel('Like').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`match_${profile.userId}`).setLabel('Match').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`pass_${profile.userId}`).setLabel('Pass').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`report_${profile.userId}`).setLabel('Report').setStyle(ButtonStyle.Danger),
    );

    // Envoyer le nouveau profil
    try {
      const sent = await channel.send({ embeds: [createProfileEmbed(profile)], components: [row] });
      setSetting('current_profile_message_id', sent.id);
      setSetting('current_profile_user_id', profile.userId);

      await interaction.reply({
        content: 'Profil posté dans le salon de rencontre ✅',
        ephemeral: true,
      });

      try {
        await logInfo(
          interaction.client,
          `Profil forcé posté: ${target.tag} (${target.id}) par ${interaction.user.tag}`,
        );
      } catch (e) {}
    } catch (e) {
      await interaction.reply({
        content: "Impossible d'envoyer le profil dans le salon.",
        ephemeral: true,
      });
      try {
        await logCritical(interaction.client, `Erreur forcerProfil: ${e.message}`);
      } catch (e) {}
    }
  },
};
