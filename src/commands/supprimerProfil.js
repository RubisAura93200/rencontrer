// src/commands/supprimerprofil.js
const {
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { db } = require("../utils/db");
const { logProfile } = require("../utils/logger");

const ADMIN_ROLE = process.env.ADMIN_ROLE_ID;
const MOD_ROLE = process.env.MODERATOR_ROLE_ID;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("supprimerprofil")
    .setDescription("Supprimer un profil (réservé au propriétaire/admin/mod)")
    .addUserOption(opt =>
      opt.setName("user")
        .setDescription("Utilisateur dont supprimer le profil")
        .setRequired(false)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser("user") || interaction.user;

    // Vérifier les permissions
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isPrivileged =
      member.permissions.has(PermissionsBitField.Flags.Administrator) ||
      (ADMIN_ROLE && member.roles.cache.has(ADMIN_ROLE)) ||
      (MOD_ROLE && member.roles.cache.has(MOD_ROLE)) ||
      interaction.user.id === interaction.guild.ownerId;

    if (target.id !== interaction.user.id && !isPrivileged) {
      return interaction.reply({
        content: "❌ Vous n’avez pas la permission de supprimer le profil d’un autre utilisateur.",
        ephemeral: true,
      });
    }

    // Vérifier si le profil existe
    const profile = db.prepare("SELECT * FROM profiles WHERE userId = ?").get(target.id);
    if (!profile) {
      return interaction.reply({
        content: "⚠️ Aucun profil trouvé pour cet utilisateur.",
        ephemeral: true,
      });
    }

    // Embed confirmation
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("⚠️ Confirmation requise")
      .setDescription(
        `Voulez-vous vraiment supprimer le profil de **${target.tag}** ?\n\n` +
        `Cette action est **irréversible**.`
      )
      .setFooter({ text: `Demande par ${interaction.user.tag}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("confirm_delete")
        .setLabel("✅ Confirmer")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("cancel_delete")
        .setLabel("❌ Annuler")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });

    // Collecteur de boutons
    const filter = i => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({
      filter,
      time: 30000, // 30 sec
    });

    collector.on("collect", async i => {
      if (i.customId === "confirm_delete") {
        // Supprimer le profil
        db.prepare("DELETE FROM profiles WHERE userId = ?").run(target.id);
        db.prepare("DELETE FROM actions WHERE userId = ? OR targetId = ?").run(target.id, target.id);
        db.prepare("DELETE FROM matches WHERE user1 = ? OR user2 = ?").run(target.id, target.id);

        await i.update({
          content: `🗑️ Profil de **${target.tag}** supprimé.`,
          embeds: [],
          components: [],
          ephemeral: true,
        });

        // Logs
        try {
          if (target.id === interaction.user.id) {
            await logProfile(
              interaction.client,
              `🗑️ ${interaction.user.tag} (${interaction.user.id}) a supprimé **son propre profil**.`
            );
          } else {
            await logProfile(
              interaction.client,
              `🗑️ ${interaction.user.tag} (${interaction.user.id}) a supprimé le profil de ${target.tag} (${target.id}).`
            );
          }
        } catch (e) {
          console.error("Erreur log suppression de profil:", e);
        }

        collector.stop();
      }

      if (i.customId === "cancel_delete") {
        await i.update({
          content: "❌ Suppression annulée.",
          embeds: [],
          components: [],
          ephemeral: true,
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
