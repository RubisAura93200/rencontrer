// src/commands/supprimerallprofils.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { db } = require("../utils/db");
const { logProfile } = require("../utils/logger");

const BOT_OWNER = process.env.BOT_OWNER_ID;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("supprimerallprofils")
    .setDescription("⚠️ Supprimer TOUS les profils de la base (réservé au propriétaire du bot)"),

  async execute(interaction) {
    if (interaction.user.id !== BOT_OWNER) {
      return interaction.reply({
        content: "❌ Cette commande est réservée **au propriétaire du bot**.",
        ephemeral: true,
      });
    }

    // Confirmation embed
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("⚠️ Confirmation requise")
      .setDescription(
        "Voulez-vous vraiment **supprimer tous les profils** de la base de données ?\n\n" +
        "Cette action est **irréversible**."
      )
      .setFooter({ text: `Demande par ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      fetchReply: true,
    });

    // Boutons de confirmation
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("confirm_wipe")
        .setLabel("✅ Confirmer")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("cancel_wipe")
        .setLabel("❌ Annuler")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ components: [row] });

    // Collecteur
    const filter = i => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000 });

    collector.on("collect", async i => {
      if (i.customId === "confirm_wipe") {
        db.prepare("DELETE FROM profiles").run();
        db.prepare("DELETE FROM actions").run();
        db.prepare("DELETE FROM matches").run();

        await i.update({
          content: "🗑️ Tous les profils ont été **supprimés** de la base de données.",
          embeds: [],
          components: [],
        });

        try {
          await logProfile(
            interaction.client,
            `🗑️ **RESET TOTAL** : tous les profils ont été supprimés par ${interaction.user.tag} (${interaction.user.id})`
          );
        } catch (e) {}

        collector.stop();
      }

      if (i.customId === "cancel_wipe") {
        await i.update({
          content: "❌ Suppression annulée.",
          embeds: [],
          components: [],
        });
        collector.stop();
      }
    });

    collector.on("end", async collected => {
      if (collected.size === 0) {
        await interaction.editReply({
          content: "⌛ Temps écoulé, suppression annulée.",
          embeds: [],
          components: [],
        });
      }
    });
  },
};
