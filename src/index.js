require("dotenv").config();
const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const { logInfo, logCritical, logProfile, logReport } = require("./utils/logger");
const { db, pickNextProfile } = require("./utils/db");

// ✅ Vérification propriétaire du bot
function isOwner(userId) {
  return userId === process.env.BOT_OWNER_ID;
}

// Création du client Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Collection();

// Charger toutes les commandes
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.warn(`[WARN] La commande ${file} est invalide (il manque "data" ou "execute").`);
  }
}

// Fonction pour créer un embed profil
function createProfileEmbed(profile) {
  return new EmbedBuilder()
    .setColor(0x00aeff)
    .setTitle(`👤 Profil de ${profile.username}`)
    .setThumbnail(profile.photo || null)
    .addFields(
      { name: "Âge", value: profile.age?.toString() || "❌ Non défini", inline: true },
      { name: "Genre", value: profile.genre || "❌ Non défini", inline: true },
      { name: "Orientation", value: profile.orientation || "❌ Non défini", inline: true },
      { name: "Relation", value: profile.relation || "❌ Non défini", inline: true },
      { name: "Likes ❤️", value: profile.likes?.toString() || "0", inline: true },
      { name: "Position", value: profile.position || "❌ Non défini", inline: true },
      { name: "Fumeur", value: profile.fumeur || "❌ Non défini", inline: true },
      { name: "Alcool", value: profile.alcool || "❌ Non défini", inline: true },
      { name: "Recherche", value: profile.recherche || "❌ Non défini", inline: false },
      { name: "Localisation", value: profile.localisation || "❌ Non défini", inline: false },
      { name: "Centres d’intérêt", value: profile.interets || "❌ Non défini", inline: false },
      { name: "Présentation", value: profile.bio || "❌ Non défini", inline: false },
    )
    .setFooter({ text: `ID: ${profile.userId}` })
    .setTimestamp();
}

// Fonction pour créer les boutons
function createProfileButtons(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`like_${userId}`).setLabel("❤️ Like").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`match_${userId}`).setLabel("💬 Match").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`pass_${userId}`).setLabel("🔄 Passer").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`report_${userId}`).setLabel("🚨 Signaler").setStyle(ButtonStyle.Danger),
  );
}

// 🔥 Fonction : notifier un match avec jolis embeds + bouton DM
async function notifyMatch(client, userAId, userBId) {
  const profileA = db.prepare("SELECT * FROM profiles WHERE userId = ?").get(userAId);
  const profileB = db.prepare("SELECT * FROM profiles WHERE userId = ?").get(userBId);

  const userA = await client.users.fetch(userAId);
  const userB = await client.users.fetch(userBId);

  const embedForA = createProfileEmbed(profileB)
    .setTitle(`💘 Nouveau match avec ${userB.username}#${userB.discriminator}`)
    .setThumbnail(profileB?.photo || userB.displayAvatarURL());

  const embedForB = createProfileEmbed(profileA)
    .setTitle(`💘 Nouveau match avec ${userA.username}#${userA.discriminator}`)
    .setThumbnail(profileA?.photo || userA.displayAvatarURL());

  const rowForA = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel(`💌 Envoyer un message à ${userB.username}`)
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/users/${userBId}`)
  );

  const rowForB = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel(`💌 Envoyer un message à ${userA.username}`)
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/users/${userAId}`)
  );

  try {
    await userA.send({ embeds: [embedForA], components: [rowForA] });
  } catch (e) {
    console.warn(`Impossible d’envoyer le MP à ${userA.username}`, e);
  }

  try {
    await userB.send({ embeds: [embedForB], components: [rowForB] });
  } catch (e) {
    console.warn(`Impossible d’envoyer le MP à ${userB.username}`, e);
  }
}

// Quand le bot est prêt
client.once("ready", () => {
  logInfo(client, `✅ Bot connecté en tant que ${client.user.tag}`);
});

// Gestion des interactions
client.on("interactionCreate", async interaction => {
  // Slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // 🔒 Si la commande est réservée au propriétaire
    if (command.ownerOnly && !isOwner(interaction.user.id)) {
      return interaction.reply({ content: "⛔ Tu n’as pas la permission d’utiliser cette commande.", ephemeral: true });
    }

    try {
      await command.execute(interaction);
      logInfo(client, `Commande exécutée: /${interaction.commandName} par ${interaction.user.tag}`);
    } catch (error) {
      logCritical(client, `Erreur sur /${interaction.commandName}: ${error.message}`);
      const replyPayload = { content: "❌ Erreur pendant exécution de la commande.", ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(replyPayload);
      } else {
        await interaction.reply(replyPayload);
      }
    }
  }

  // Boutons (like / pass / report / match)
  if (interaction.isButton()) {
    const [action, targetId] = interaction.customId.split("_");
    let replyMsg = "";

    if (action === "like") {
      const already = db
        .prepare("SELECT 1 FROM actions WHERE userId = ? AND targetId = ? AND action = 'like'")
        .get(interaction.user.id, targetId);
      if (already) {
        return interaction.reply({ content: "⚠️ Tu as déjà liké ce profil.", ephemeral: true });
      }

      db.prepare("UPDATE profiles SET likes = likes + 1 WHERE userId = ?").run(targetId);
      db.prepare("INSERT INTO actions (userId, targetId, action, created_at) VALUES (?,?,?,?)")
        .run(interaction.user.id, targetId, "like", Date.now());

      const updatedProfile = db.prepare("SELECT * FROM profiles WHERE userId = ?").get(targetId);
      replyMsg = `👍 Vous avez liké <@${targetId}> (total ❤️ ${updatedProfile.likes})`;
      logProfile(client, `${interaction.user.tag} a liké <@${targetId}> (❤️ ${updatedProfile.likes})`);

      const mutual = db
        .prepare("SELECT 1 FROM actions WHERE userId = ? AND targetId = ? AND action = 'like'")
        .get(targetId, interaction.user.id);

      if (mutual) {
        const alreadyMatch = db.prepare(
          `SELECT 1 FROM matches 
           WHERE (user1 = ? AND user2 = ?) OR (user1 = ? AND user2 = ?)`
        ).get(interaction.user.id, targetId, targetId, interaction.user.id);

        if (!alreadyMatch) {
          db.prepare("INSERT INTO matches (user1, user2, created_at) VALUES (?,?,?)")
            .run(interaction.user.id, targetId, Date.now());

          replyMsg = `💖 Match trouvé avec <@${targetId}> !`;
          await notifyMatch(interaction.client, interaction.user.id, targetId);
        }
      }

      try {
        const embed = createProfileEmbed(updatedProfile);
        const row = createProfileButtons(updatedProfile.userId);
        await interaction.message.edit({ embeds: [embed], components: [row] });
      } catch (e) {
        console.error("Erreur mise à jour profil après like:", e);
      }
    }

    if (action === "match") {
      const already = db
        .prepare("SELECT 1 FROM match_requests WHERE fromUser = ? AND toUser = ?")
        .get(interaction.user.id, targetId);
      if (already) {
        return interaction.reply({ content: "⚠️ Tu as déjà demandé un match à cette personne.", ephemeral: true });
      }

      db.prepare("INSERT INTO match_requests (fromUser, toUser, created_at) VALUES (?,?,?)")
        .run(interaction.user.id, targetId, Date.now());
      replyMsg = `💬 Vous avez demandé un match avec <@${targetId}>.`;

      const mutualMatch = db
        .prepare("SELECT 1 FROM match_requests WHERE fromUser = ? AND toUser = ?")
        .get(targetId, interaction.user.id);

      if (mutualMatch) {
        const alreadyMatch = db.prepare(
          `SELECT 1 FROM matches 
           WHERE (user1 = ? AND user2 = ?) OR (user1 = ? AND user2 = ?)`
        ).get(interaction.user.id, targetId, targetId, interaction.user.id);

        if (!alreadyMatch) {
          db.prepare("INSERT INTO matches (user1, user2, created_at) VALUES (?,?,?)")
            .run(interaction.user.id, targetId, Date.now());

          replyMsg = `💖 Match confirmé avec <@${targetId}> !`;
          await notifyMatch(interaction.client, interaction.user.id, targetId);
        }
      }
    }

    if (action === "pass") {
      const oneHourAgo = Date.now() - 3600000;
      const passCount = db
        .prepare("SELECT COUNT(*) as count FROM actions WHERE userId = ? AND action = 'pass' AND created_at > ?")
        .get(interaction.user.id, oneHourAgo).count;

      if (passCount >= 10) {
        return interaction.reply({
          content: "⚠️ Tu as déjà passé 10 profils cette heure-ci. Reviens plus tard 😉",
          ephemeral: true,
        });
      }

      db.prepare("INSERT INTO actions (userId, targetId, action, created_at) VALUES (?,?,?,?)")
        .run(interaction.user.id, targetId, "pass", Date.now());

      const remaining = 10 - (passCount + 1);
      replyMsg = `➡️ Vous passez ce profil. (Pass restants : ${remaining}/10 cette heure-ci)`;
      logProfile(client, `${interaction.user.tag} a passé <@${targetId}> (${remaining}/10 restants)`);

      try {
        await interaction.message.delete();
      } catch (e) {
        console.error("Erreur suppression profil:", e);
      }

      try {
        const nextProfile = pickNextProfile(interaction.user.id);
        if (nextProfile) {
          const embed = createProfileEmbed(nextProfile);
          const row = createProfileButtons(nextProfile.userId);
          const channel = await interaction.client.channels.fetch(process.env.DATING_CHANNEL_ID);
          if (channel) {
            await channel.send({ embeds: [embed], components: [row] });
          }
        } else {
          await interaction.reply({ content: "⚠️ Plus aucun profil dispo.", ephemeral: true });
        }
      } catch (e) {
        console.error("Erreur lors du chargement d’un nouveau profil:", e);
      }
    }

    if (action === "report") {
      db.prepare("INSERT INTO actions (userId, targetId, action, created_at) VALUES (?,?,?,?)")
        .run(interaction.user.id, targetId, "report", Date.now());

      replyMsg = `⚠️ Signalement envoyé contre <@${targetId}>.`;
      logReport(client, `${interaction.user.tag} a signalé <@${targetId}>`);
    }

    if (replyMsg) {
      await interaction.reply({ content: replyMsg, ephemeral: true });
    }
  }
});

// Lancer le bot
client.login(process.env.DISCORD_TOKEN);
