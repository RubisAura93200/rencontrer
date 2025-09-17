// src/commands/syncmembers.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { db } = require("../utils/db");

const OWNER_ID = process.env.BOT_OWNER_ID;

function safeStringify(obj) {
  try {
    if (!obj) return null;
    if (typeof obj.toJSON === "function") return JSON.stringify(obj.toJSON());
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
    .setName("syncmembers")
    .setDescription("📥 Synchronise tous les membres du serveur dans la DB (propriétaire uniquement)"),

  async execute(interaction) {
    if (interaction.user.id !== OWNER_ID) {
      return interaction.reply({
        content: "❌ Seul le propriétaire du bot peut utiliser cette commande.",
        ephemeral: true,
      });
    }

    await interaction.reply("🔄 Synchronisation des membres en cours... (cela peut prendre du temps)");

    const guild = interaction.guild;
    const allMembers = await guild.members.fetch();
    const total = allMembers.size;
    let count = 0;

    const startTime = Date.now();
    let lastUpdate = Date.now();

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

    for (const [id, member] of allMembers) {
      const user = member.user;
      let fetchedUser = user;
      try {
        fetchedUser = await interaction.client.users.fetch(user.id, { force: true });
      } catch (e) {
        fetchedUser = user;
      }

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
        JSON.stringify([]), // connections (OAuth2 only)

        member.nickname || null,
        JSON.stringify(member.roles.cache.map(r => r.id)),
        member.joinedTimestamp ?? null,
        null, // left_at
        member.premiumSinceTimestamp ?? null,
        member.permissions?.toArray().join(",") || null,

        member.pending ? 1 : 0,
        member.communicationDisabledUntilTimestamp ?? null,
        member.voice?.serverDeaf ? 1 : 0,
        member.voice?.serverMute ? 1 : 0,

        member.voice?.channelId || null,
        member.voice?.selfMute ? 1 : 0,
        member.voice?.selfDeaf ? 1 : 0,
        member.voice?.streaming ? 1 : 0,
        member.voice?.selfVideo ? 1 : 0,

        Date.now(),
      ];

      try {
        insertMemberStmt.run(...vals);
      } catch (err) {
        console.error("DB error inserting member:", err);
      }

      try {
        const rawUser = safeStringify(fetchedUser);
        const rawMember = safeStringify(member);
        insertRawStmt.run(fetchedUser.id, rawUser, rawMember, Date.now());
      } catch (err) {
        console.error("DB error inserting members_raw:", err);
      }

      count++;

      // Mise à jour toutes les 10 secondes
      if (Date.now() - lastUpdate > 10_000 || count === total) {
        lastUpdate = Date.now();
        const elapsed = (Date.now() - startTime) / 1000; // sec
        const rate = count / elapsed; // membres/sec
        const remaining = total - count;
        const eta = rate > 0 ? (remaining / rate) : 0;

        const status = `⏳ Synchronisation en cours... (${count}/${total})\n⏱️ Temps écoulé: ${elapsed.toFixed(1)}s\n⌛ ETA: ~${eta.toFixed(1)}s`;

        try {
          await interaction.editReply(status);
        } catch (err) {
          console.warn("⚠️ Impossible de mettre à jour le message d'interaction:", err.message);
        }
      }

      // Petit délai pour éviter le ratelimit
      await new Promise(res => setTimeout(res, 30));
    }

    // Audit logs (optionnel)
    try {
      if (guild.members.me.permissions.has("ViewAuditLog")) {
        const logs = await guild.fetchAuditLogs({ limit: 50 });
        const insertAudit = db.prepare(`
          INSERT INTO audit_logs (guildId, action_type, target_id, user_id, reason, created_at, raw_entry)
          VALUES (?,?,?,?,?,?,?)
        `);
        for (const entry of logs.entries.values()) {
          try {
            insertAudit.run(
              guild.id,
              String(entry.action),
              String(entry.targetId ?? ""),
              String(entry.executor?.id ?? ""),
              entry.reason ?? null,
              entry.createdTimestamp ?? Date.now(),
              JSON.stringify({
                id: entry.id,
                changes: entry.changes,
                extra: entry.extra,
                options: entry.options,
              })
            );
          } catch (_) {}
        }
      }
    } catch (_) {}

    const embed = new EmbedBuilder()
      .setColor(0x00aeff)
      .setTitle("✅ Synchronisation terminée")
      .setDescription(`Membres synchronisés : **${count}/${total}**`)
      .addFields(
        { name: "Serveur", value: guild.name, inline: true },
        { name: "Membres traités", value: `${count}`, inline: true }
      )
      .setTimestamp();

    try {
      await interaction.editReply({ content: "", embeds: [embed] });
    } catch (err) {
      console.warn("⚠️ Impossible d'envoyer l'embed final:", err.message);
    }
  },
};
