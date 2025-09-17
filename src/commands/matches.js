// src/commands/matches.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { db } = require("../utils/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("matches")
    .setDescription("Voir la liste de tous vos matchs"),

  async execute(interaction) {
    try {
      const userId = interaction.user.id;

      // ✅ Déférer immédiatement pour éviter l’expiration
      await interaction.deferReply({ ephemeral: true });

      // Récupérer les matchs récents (max 20 pour éviter un embed trop long)
      const rows = db.prepare(`
        SELECT * FROM matches
        WHERE user1 = ? OR user2 = ?
        ORDER BY created_at DESC
        LIMIT 20
      `).all(userId, userId);

      if (!rows.length) {
        return interaction.editReply({
          content: "❌ Vous n’avez aucun match pour l’instant.",
        });
      }

      // Construire la liste formatée
      const matchsList = rows
        .map((r, i) => {
          const partnerId = r.user1 === userId ? r.user2 : r.user1;
          const timestamp = r.created_at
            ? `<t:${Math.floor(r.created_at / 1000)}:d>`
            : "date inconnue";
          return `${i + 1}. 💞 <@${partnerId}> (match le ${timestamp})`;
        })
        .join("\n");

      // Embed récapitulatif
      const embed = new EmbedBuilder()
        .setColor(0xff66cc)
        .setTitle(`💘 Vos matchs (${rows.length})`)
        .setDescription(matchsList)
        .setFooter({ text: `ID: ${userId}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error("Erreur commande /matches:", error);

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: "❌ Une erreur est survenue lors de la récupération de vos matchs.",
        });
      } else {
        await interaction.reply({
          content: "❌ Une erreur est survenue lors de la récupération de vos matchs.",
          ephemeral: true,
        });
      }
    }
  },
};
