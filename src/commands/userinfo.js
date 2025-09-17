// src/commands/userinfo.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { db } = require("../utils/db");

const OWNER_ID = process.env.BOT_OWNER_ID;

function safeStringify(obj) {
  try {
    if (!obj) return null;
    if (typeof obj.toJSON === "function") return JSON.stringify(obj.toJSON(), null, 2);
    const seen = new WeakSet();
    return JSON.stringify(obj, function (k, v) {
      if (typeof v === "object" && v !== null) {
        if (seen.has(v)) return;
        seen.add(v);
      }
      if (typeof v === "bigint") return v.toString();
      return v;
    }, 2);
  } catch (e) {
    return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Voir toutes les infos d’un utilisateur (propriétaire uniquement)")
    .addUserOption(option =>
      option.setName("membre").setDescription("Le membre à inspecter").setRequired(true)
    ),

  // Owner only marker (utilisé par ton index si tu checkes command.ownerOnly)
  ownerOnly: true,

  async execute(interaction) {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({ content: "❌ Seul le propriétaire du bot peut utiliser cette commande.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    const user = interaction.options.getUser("membre", true);

    // try to fetch fresh user + guildMember
    let fetchedUser = user;
    try { fetchedUser = await interaction.client.users.fetch(user.id, { force: true }); } catch (e) { fetchedUser = user; }
    let guildMember = null;
    try { guildMember = await interaction.guild.members.fetch(user.id); } catch (e) { guildMember = null; }

    // Check DB
    let memberData = db.prepare("SELECT * FROM members WHERE userId = ?").get(user.id);
    let rawData = db.prepare("SELECT raw_user, raw_member FROM members_raw WHERE userId = ?").get(user.id);

    // If not in DB, insert now (single insert copy of sync logic)
    if (!memberData) {
      try {
        const insertMemberStmt = db.prepare(`
        INSERT OR REPLACE INTO members (
            userId, username, global_name, discriminator, avatar, banner, accent_color, public_flags, created_at_account,
            locale, email, connections, nick, roles, joined_at, left_at, premium_since, permissions,
            pending, communication_disabled_until, deaf, mute,
            voice_channel, voice_self_mute, voice_self_deaf, voice_stream, voice_camera,
            updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `);
        
        const insertRawStmt = db.prepare(`
          INSERT OR REPLACE INTO members_raw (userId, raw_user, raw_member, last_fetched) VALUES (?,?,?,?)
        `);

        const rolesArray = guildMember ? guildMember.roles.cache.map(r => r.id) : [];

        const vals = [
          fetchedUser.id,
          fetchedUser.username || null,
          fetchedUser.globalName || null,
          fetchedUser.discriminator || null,
          fetchedUser.displayAvatarURL?.({ dynamic: true, size: 1024 }) || null,
          fetchedUser.banner || null,
          fetchedUser.accentColor ?? null,
          fetchedUser.flags?.bitfield ?? null,
          fetchedUser.createdTimestamp ?? null,

          fetchedUser.locale ?? null,
          fetchedUser.email ?? null,
          JSON.stringify([]),

          guildMember?.nickname || null,
          JSON.stringify(rolesArray),
          guildMember?.joinedTimestamp ?? null,
          null,
          guildMember?.premiumSinceTimestamp ?? null,
          guildMember?.permissions?.toArray().join(",") || null,

          guildMember?.pending ? 1 : 0,
          guildMember?.communicationDisabledUntilTimestamp ?? null,
          guildMember?.voice?.serverDeaf ? 1 : 0,
          guildMember?.voice?.serverMute ? 1 : 0,

          guildMember?.voice?.channelId || null,
          guildMember?.voice?.selfMute ? 1 : 0,
          guildMember?.voice?.selfDeaf ? 1 : 0,
          guildMember?.voice?.streaming ? 1 : 0,
          guildMember?.voice?.selfVideo ? 1 : 0,

          Date.now()
        ];

        insertMemberStmt.run(...vals);

        const rawUser = safeStringify(fetchedUser);
        const rawMember = safeStringify(guildMember);
        insertRawStmt.run(fetchedUser.id, rawUser, rawMember, Date.now());

        memberData = db.prepare("SELECT * FROM members WHERE userId = ?").get(user.id);
        rawData = db.prepare("SELECT raw_user, raw_member FROM members_raw WHERE userId = ?").get(user.id);
      } catch (err) {
        console.error("DB error inserting single member:", err);
      }
    }

    if (!memberData) {
      return interaction.editReply({ content: `❌ Impossible de récupérer les infos pour ${user.tag}`, ephemeral: true });
    }

    // Build embeds — séparés proprement
    const accountEmbed = new EmbedBuilder()
      .setTitle(`🔎 Compte Discord — ${fetchedUser.tag}`)
      .setThumbnail(fetchedUser.displayAvatarURL?.({ dynamic: true, size: 1024 }) || null)
      .setColor(0x0099ff)
      .addFields(
        { name: "🆔 ID", value: String(memberData.userId), inline: true },
        { name: "👤 Username", value: `${memberData.username || "N/A"}#${memberData.discriminator || "N/A"}`, inline: true },
        { name: "🌐 Global name", value: memberData.global_name || "❌", inline: true },
        { name: "🗓️ Créé le", value: memberData.created_at_account ? `<t:${Math.floor(memberData.created_at_account/1000)}:F>` : "❌", inline: true },
        { name: "🏷️ Badges (public_flags)", value: String(memberData.public_flags ?? "0"), inline: true },
        { name: "🎨 Accent / Banner", value: memberData.accent_color || (memberData.banner ? "Has banner" : "❌"), inline: true }
      );

    const serverEmbed = new EmbedBuilder()
      .setTitle(`🏛️ Infos sur le serveur — ${interaction.guild.name}`)
      .setColor(0x00aeff)
      .addFields(
        { name: "📛 Surnom (nick)", value: memberData.nick || "❌", inline: true },
        { name: "🎖️ Rôles", value: (memberData.roles ? JSON.parse(memberData.roles).map(r => `<@&${r}>`).join(", ") : "❌"), inline: false },
        { name: "📅 Arrivé", value: memberData.joined_at ? `<t:${Math.floor(memberData.joined_at/1000)}:F>` : "❌", inline: true },
        { name: "🚀 Boost", value: memberData.premium_since ? `<t:${Math.floor(memberData.premium_since/1000)}:F>` : "❌", inline: true },
        { name: "⚙️ Permissions", value: memberData.permissions || "❌", inline: false },
        { name: "🔁 Mis à jour DB", value: memberData.updated_at ? `<t:${Math.floor(memberData.updated_at/1000)}:F>` : "❌", inline: true }
      );

    const presenceEmbed = new EmbedBuilder()
      .setTitle("📶 Présence & Voix")
      .setColor(0xffcc00);

    // minimal presence / voice info
    const voiceChannel = memberData.voice_channel ? `<#${memberData.voice_channel}>` : "❌";
    presenceEmbed.addFields(
      { name: "Canal vocal", value: voiceChannel, inline: true },
      { name: "ServerMute / ServerDeaf", value: `${memberData.mute ? "mute" : "ok"} / ${memberData.deaf ? "deaf" : "ok"}`, inline: true },
      { name: "SelfMute / SelfDeaf", value: `${memberData.voice_self_mute ? "oui" : "non"} / ${memberData.voice_self_deaf ? "oui" : "non"}`, inline: true },
      { name: "Streaming / Cam", value: `${memberData.voice_stream ? "oui" : "non"} / ${memberData.voice_camera ? "oui" : "non"}`, inline: true }
    );

    const rawSummary = new EmbedBuilder()
      .setTitle("🔧 Données brutes (résumé)")
      .setColor(0x555555)
      .setDescription([
        `\`roles\`: ${(memberData.roles ? JSON.parse(memberData.roles).length : 0)}`,
        `\`connections\`: ${memberData.connections ? memberData.connections.length : 0}`,
        `\`email\`: ${memberData.email ? "oui" : "non"}`,
        `\`raw JSON disponible\`: ${rawData ? "oui" : "non"}`
      ].join(" • "));

    // reply with embeds
    try {
      await interaction.editReply({ content: null, embeds: [accountEmbed, serverEmbed, presenceEmbed, rawSummary] });
    } catch (err) {
      console.error("Erreur affichage userinfo:", err);
      return interaction.followUp({ content: "❌ Erreur lors de l'affichage des infos.", ephemeral: true });
    }

    // attach raw JSON files (if exist) so tu as tout (very useful for debug)
    try {
      if (rawData?.raw_user) {
        const buffer = Buffer.from(rawData.raw_user, "utf8");
        await interaction.followUp({ files: [{ attachment: buffer, name: `${user.id}-raw-user.json` }], ephemeral: true });
      }
      if (rawData?.raw_member) {
        const buffer2 = Buffer.from(rawData.raw_member, "utf8");
        await interaction.followUp({ files: [{ attachment: buffer2, name: `${user.id}-raw-member.json` }], ephemeral: true });
      }
    } catch (e) {
      // ignore attach errors
      console.warn("Erreur envoi raw json:", e);
    }
  },
};
