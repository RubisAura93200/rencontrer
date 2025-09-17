// src/commands/profil.js
const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const { db } = require("../utils/db");
const { logProfile } = require("../utils/logger");

// Création de l'embed profil
function createProfileEmbed(profile, user) {
  return new EmbedBuilder()
    .setColor(0x00aeff)
    .setTitle(`👤 Profil de ${user.username}`)
    .setThumbnail(profile.photo || user.displayAvatarURL())
    .addFields(
      {
        name: "📌 Informations générales",
        value:
          `Âge: ${profile.age || "❌"}\n` +
          `Taille: ${profile.height || "❌"}\n` +
          `Poids: ${profile.weight || "❌"}\n` +
          `Morphologie: ${profile.morphologie || "❌"}\n` +
          `Ethnicité: ${profile.ethnicite || "❌"}\n` +
          `Relation: ${profile.relation || "❌"}`,
      },
      {
        name: "💪 Attentes",
        value:
          `Je recherche: ${profile.attentes || "❌"}\n` +
          `Lieu de rencontre: ${profile.meeting || "❌"}\n` +
          `NSFW en privé: ${profile.nsfw || "❌"}`,
      },
      {
        name: "🏷️ Identité",
        value:
          `Genre: ${profile.gender || "❌"}\n` +
          `Pronoms: ${profile.pronouns || "❌"}\n` +
          `Orientation: ${profile.orientation || "❌"}\n` +
          `Position: ${profile.position || "❌"}`,
      },
      { name: "🐾 Tribes", value: profile.tribes || "❌", inline: false },
      { name: "📍 Localisation", value: profile.localisation || "❌", inline: false },
      { name: "🎯 Centres d’intérêt", value: profile.interets || "❌", inline: false },
      { name: "📝 Présentation", value: profile.bio || "❌", inline: false }
    )
    .setFooter({ text: `ID: ${user.id}` })
    .setTimestamp();
}

// Boutons publics
function createProfileButtons(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`like_${userId}`)
      .setLabel("❤️ Like")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`match_${userId}`)
      .setLabel("💬 Match")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`pass_${userId}`)
      .setLabel("🔄 Passer")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`report_${userId}`)
      .setLabel("🚨 Signaler")
      .setStyle(ButtonStyle.Danger)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profil")
    .setDescription("Créer ou voir ton profil complet")
    .addIntegerOption(opt =>
      opt.setName("age").setDescription("Ton âge").setMinValue(14).setMaxValue(99)
    )
    .addStringOption(opt => opt.setName("taille").setDescription("Ta taille (ex: 1m80)"))
    .addStringOption(opt => opt.setName("poids").setDescription("Ton poids (ex: 75kg)"))
    .addStringOption(opt =>
      opt.setName("morphologie").setDescription("Ta morphologie").addChoices(
        { name: "Non affiché", value: "Non affiché" },
        { name: "Entretenu", value: "Entretenu" },
        { name: "Moyen", value: "Moyen" },
        { name: "Grand", value: "Grand" },
        { name: "Musclé", value: "Musclé" },
        { name: "Mince", value: "Mince" },
        { name: "Trapu", value: "Trapu" }
      )
    )
    .addStringOption(opt =>
      opt.setName("ethnicite").setDescription("Ton ethnicité").addChoices(
        { name: "Non affiché", value: "Non affiché" },
        { name: "Asiatique", value: "Asiatique" },
        { name: "Noir", value: "Noir" },
        { name: "Latino", value: "Latino" },
        { name: "Moyen-orient", value: "Moyen-orient" },
        { name: "Métis", value: "Métis" },
        { name: "Amérindien", value: "Amérindien" },
        { name: "Blanc", value: "Blanc" },
        { name: "Sud-asiatique", value: "Sud-asiatique" },
        { name: "Autre", value: "Autre" }
      )
    )
    .addStringOption(opt =>
      opt.setName("tribes").setDescription("Tes tribus (séparées par virgule)")
    )
    .addStringOption(opt =>
      opt.setName("attentes").setDescription("Ce que tu recherches").addChoices(
        { name: "Discussion", value: "Discussion" },
        { name: "Rendez-vous", value: "Rendez-vous" },
        { name: "Amitié", value: "Amitié" },
        { name: "Réseau", value: "Réseau" },
        { name: "Relation", value: "Relation" },
        { name: "Coup d’un soir", value: "Coup d’un soir" }
      )
    )
    .addStringOption(opt =>
      opt.setName("meeting").setDescription("Lieu de rencontre").addChoices(
        { name: "Chez moi", value: "Chez moi" },
        { name: "Chez toi", value: "Chez toi" },
        { name: "Bar", value: "Bar" },
        { name: "Café", value: "Café" },
        { name: "Restaurant", value: "Restaurant" }
      )
    )
    .addStringOption(opt =>
      opt.setName("nsfw").setDescription("Images NSFW en privé ?").addChoices(
        { name: "Non affiché", value: "Non affiché" },
        { name: "Jamais", value: "Jamais" },
        { name: "Pas au premier contact", value: "Pas au premier contact" },
        { name: "Oui", value: "Oui" }
      )
    )
    .addStringOption(opt =>
      opt.setName("gender").setDescription("Ton genre").addChoices(
        { name: "Homme", value: "Homme" },
        { name: "Homme cis", value: "Homme cis" },
        { name: "Homme trans", value: "Homme trans" },
        { name: "Femme", value: "Femme" },
        { name: "Femme cis", value: "Femme cis" },
        { name: "Femme trans", value: "Femme trans" }
      )
    )
    .addStringOption(opt =>
      opt.setName("pronoms").setDescription("Tes pronoms").addChoices(
        { name: "Il/Lui", value: "Il/Lui" },
        { name: "Elle/Elle", value: "Elle/Elle" },
        { name: "Iel", value: "Iel" },
        { name: "Ze/Hir", value: "Ze/Hir" },
        { name: "Ze/Zir", value: "Ze/Zir" },
        { name: "Uniquement mon prénom", value: "Uniquement mon prénom" },
        { name: "Me demander", value: "Me demander" }
      )
    )
    .addStringOption(opt =>
      opt.setName("orientation").setDescription("Ton orientation").addChoices(
        { name: "Hétéro", value: "Hétéro" },
        { name: "Homo", value: "Homo" },
        { name: "Bi", value: "Bi" },
        { name: "Pan", value: "Pan" },
        { name: "Asexuel", value: "Asexuel" },
        { name: "Autre", value: "Autre" }
      )
    )
    .addStringOption(opt =>
      opt.setName("relation").setDescription("Ton statut relationnel").addChoices(
        { name: "Célibataire", value: "Célibataire" },
        { name: "En couple", value: "En couple" },
        { name: "En crush", value: "En crush" },
        { name: "Amoureux", value: "Amoureux" },
        { name: "Couple libre", value: "Couple libre" },
        { name: "C'est compliqué", value: "C'est compliqué" }
      )
    )
    .addStringOption(opt =>
      opt.setName("position").setDescription("Ta position").addChoices(
        { name: "Actif", value: "Actif" },
        { name: "Actif polyvalent", value: "Actif polyvalent" },
        { name: "Passif", value: "Passif" },
        { name: "Passif polyvalent", value: "Passif polyvalent" },
        { name: "Polyvalent", value: "Polyvalent" }
      )
    )
    .addStringOption(opt =>
      opt.setName("fumeur").setDescription("Fumeur ?").addChoices(
        { name: "Oui", value: "Oui" },
        { name: "Non", value: "Non" },
        { name: "Occasionnellement", value: "Occasionnellement" }
      )
    )
    .addStringOption(opt =>
      opt.setName("alcool").setDescription("Alcool ?").addChoices(
        { name: "Oui", value: "Oui" },
        { name: "Non", value: "Non" },
        { name: "Occasionnellement", value: "Occasionnellement" }
      )
    )
    .addStringOption(opt => opt.setName("localisation").setDescription("Ta localisation"))
    .addStringOption(opt => opt.setName("interets").setDescription("Tes centres d’intérêt"))
    .addStringOption(opt => opt.setName("bio").setDescription("Présentation libre"))
    .addAttachmentOption(opt => opt.setName("photo").setDescription("Photo de profil (image)"))
    .addStringOption(opt => opt.setName("photolien").setDescription("Lien d’une photo de profil")),

  async execute(interaction) {
    try {
      const user = interaction.user;
      const userId = user.id;

      const options = {
        age: interaction.options.getInteger("age"),
        height: interaction.options.getString("taille"),
        weight: interaction.options.getString("poids"),
        morphologie: interaction.options.getString("morphologie"),
        ethnicite: interaction.options.getString("ethnicite"),
        tribes: interaction.options.getString("tribes"),
        attentes: interaction.options.getString("attentes"),
        meeting: interaction.options.getString("meeting"),
        nsfw: interaction.options.getString("nsfw"),
        gender: interaction.options.getString("gender"),
        pronouns: interaction.options.getString("pronoms"),
        orientation: interaction.options.getString("orientation"),
        relation: interaction.options.getString("relation"),
        position: interaction.options.getString("position"),
        fumeur: interaction.options.getString("fumeur"),
        alcool: interaction.options.getString("alcool"),
        localisation: interaction.options.getString("localisation"),
        interets: interaction.options.getString("interets"),
        bio: interaction.options.getString("bio"),
        photoFile: interaction.options.getAttachment("photo"),
        photoLien: interaction.options.getString("photolien"),
      };

      let photo = null;
      if (options.photoFile && options.photoFile.contentType?.startsWith("image/")) {
        photo = options.photoFile.url;
      } else if (options.photoLien?.startsWith("http")) {
        photo = options.photoLien;
      }

      const existing = db.prepare("SELECT * FROM profiles WHERE userId = ?").get(userId);

      if (existing) {
        db.prepare(
          `UPDATE profiles SET 
            age=?, height=?, weight=?, morphologie=?, ethnicite=?, tribes=?, attentes=?, meeting=?, nsfw=?, gender=?, pronouns=?, 
            orientation=?, relation=?, position=?, fumeur=?, alcool=?, localisation=?, interets=?, bio=?, photo=?, username=? 
            WHERE userId=?`
        ).run(
          options.age ?? existing.age,
          options.height ?? existing.height,
          options.weight ?? existing.weight,
          options.morphologie ?? existing.morphologie,
          options.ethnicite ?? existing.ethnicite,
          options.tribes ?? existing.tribes,
          options.attentes ?? existing.attentes,
          options.meeting ?? existing.meeting,
          options.nsfw ?? existing.nsfw,
          options.gender ?? existing.gender,
          options.pronouns ?? existing.pronouns,
          options.orientation ?? existing.orientation,
          options.relation ?? existing.relation,
          options.position ?? existing.position,
          options.fumeur ?? existing.fumeur,
          options.alcool ?? existing.alcool,
          options.localisation ?? existing.localisation,
          options.interets ?? existing.interets,
          options.bio ?? existing.bio,
          photo ?? existing.photo,
          user.username,
          userId
        );

        await interaction.reply({ content: "✅ Profil mis à jour", flags: 64 });
        await logProfile(interaction.client, `${user.username} a mis à jour son profil`);
      } else {
        db.prepare(
          `INSERT INTO profiles 
          (userId, username, age, height, weight, morphologie, ethnicite, tribes, attentes, meeting, nsfw, gender, pronouns,
           orientation, relation, position, fumeur, alcool, localisation, interets, bio, photo, likes, created_at) 
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).run(
          userId,
          user.username,
          options.age,
          options.height,
          options.weight,
          options.morphologie,
          options.ethnicite,
          options.tribes,
          options.attentes,
          options.meeting,
          options.nsfw,
          options.gender,
          options.pronouns,
          options.orientation,
          options.relation,
          options.position,
          options.fumeur,
          options.alcool,
          options.localisation,
          options.interets,
          options.bio,
          photo,
          0,
          Date.now()
        );

        await interaction.reply({ content: "✅ Profil créé", flags: 64 });
        await logProfile(interaction.client, `${user.username} a créé son profil`);
      }

      const profile = db.prepare("SELECT * FROM profiles WHERE userId = ?").get(userId);
      const embed = createProfileEmbed(profile, user);
      const row = createProfileButtons(userId);

      await interaction.followUp({ embeds: [embed], ephemeral: true });

      try {
        const staffChannel = await interaction.client.channels.fetch(
          String(process.env.PROFILE_LOG_CHANNEL_ID)
        );
        if (staffChannel) {
          await staffChannel.send({
            content: `📝 Nouveau profil / mise à jour : **${user.username}**`,
            embeds: [embed],
          });
        }
      } catch (err) {
        console.error("Erreur log staff:", err);
      }

      try {
        const datingChannel = await interaction.client.channels.fetch(
          process.env.DATING_CHANNEL_ID
        );
        if (datingChannel) {
          await datingChannel.send({ embeds: [embed], components: [row] });
        }
      } catch (err) {
        console.error("Erreur salon public:", err);
      }
    } catch (error) {
      console.error("Erreur /profil:", error);
      await interaction.reply({
        content: "❌ Une erreur est survenue lors de la création/mise à jour du profil.",
        flags: 64,
      });
    }
  },
};
