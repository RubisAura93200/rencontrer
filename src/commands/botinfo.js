// src/commands/botinfo.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { db } = require('../utils/db');

const BOT_OWNER_ID = process.env.BOT_OWNER_ID; // mettre dans .env

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Informations complètes et statistiques du bot (réservé au propriétaire)'),


  async execute(interaction) {
    try {
      // autorisations : bot owner OU propriétaire du serveur
      const isBotOwner = interaction.user.id === BOT_OWNER_ID;
      const isGuildOwner = interaction.guild && (interaction.user.id === interaction.guild.ownerId);
      if (!isBotOwner && !isGuildOwner) {
        return interaction.reply({ content: '❌ Seul le propriétaire du bot ou du serveur peut utiliser cette commande.', ephemeral: true });
      }

      // --- BOT / CLIENT ---
      const client = interaction.client;
      const botUser = client.user;
      const botTag = botUser ? `${botUser.username}#${botUser.discriminator}` : 'N/A';
      const botId = botUser ? botUser.id : 'N/A';
      const botCreatedAt = botUser ? Math.floor(botUser.createdTimestamp / 1000) : null;
      const presence = client.presence?.status || 'unknown';
      const activities = (client.presence?.activities || []).map(a => a.name).filter(Boolean);
      const wsPing = Math.round(client.ws.ping);

      // --- PACKAGE / ENV ---
      let discordJsVersion = 'unknown';
      try { discordJsVersion = require('discord.js').version; } catch (e) {}
      const nodeVersion = process.version;

      // --- GLOBAUX (across bot) ---
      const guildCount = client.guilds.cache.size;
      // calc channels/users/roles counts (cached)
      let totalChannels = 0;
      let totalMembers = 0;
      let totalBots = 0;
      let totalUsersUnique = new Set();
      let totalRoles = 0;
      client.guilds.cache.forEach(g => {
        totalChannels += g.channels.cache.size;
        totalRoles += g.roles.cache.size;
        g.members.cache.forEach(m => {
          totalMembers++;
          if (m.user.bot) totalBots++;
          totalUsersUnique.add(m.user.id);
        });
      });

      // --- DB STATS ---
      // total profiles
      const totalProfilesRow = db.prepare('SELECT COUNT(*) as c FROM profiles').get();
      const totalProfiles = totalProfilesRow ? totalProfilesRow.c : 0;

      // total likes aggregated (sum of likes column)
      const totalLikesRow = db.prepare('SELECT SUM(likes) as s FROM profiles').get();
      const totalLikes = totalLikesRow && totalLikesRow.s ? totalLikesRow.s : 0;

      // total matches
      const totalMatchesRow = db.prepare('SELECT COUNT(*) as c FROM matches').get();
      const totalMatches = totalMatchesRow ? totalMatchesRow.c : 0;

      // total actions
      const totalActionsRow = db.prepare('SELECT COUNT(*) as c FROM actions').get();
      const totalActions = totalActionsRow ? totalActionsRow.c : 0;

      // total reports
      const totalReportsRow = db.prepare("SELECT COUNT(*) as c FROM actions WHERE action = 'report'").get();
      const totalReports = totalReportsRow ? totalReportsRow.c : 0;

      // total passes
      const totalPassesRow = db.prepare("SELECT COUNT(*) as c FROM actions WHERE action = 'pass'").get();
      const totalPasses = totalPassesRow ? totalPassesRow.c : 0;

      // DB file size
      const dbFilePath = path.join(__dirname, '..', '..', 'data', 'database.sqlite');
      let dbFileSize = 'N/A';
      try {
        const st = fs.statSync(dbFilePath);
        dbFileSize = `${Math.round((st.size / 1024 / 1024) * 100) / 100} MB`;
      } catch (e) {
        dbFileSize = '—';
      }

      // TOPS (top 5 likés, top 5 matchés, top 5 reportés)
      const topLiked = db.prepare('SELECT userId, username, likes FROM profiles ORDER BY likes DESC LIMIT 5').all();
      const topReported = db.prepare(`
        SELECT targetId as userId, COUNT(*) as cnt 
        FROM actions WHERE action = 'report'
        GROUP BY targetId ORDER BY cnt DESC LIMIT 5
      `).all();
      // top matched: aggregate matches table
      const topMatched = db.prepare(`
        SELECT uid, COUNT(*) as cnt FROM (
          SELECT user1 as uid FROM matches
          UNION ALL
          SELECT user2 as uid FROM matches
        ) GROUP BY uid ORDER BY cnt DESC LIMIT 5
      `).all();

      // LAST EVENTS (5 derniers likes/matches/reports)
      const lastLikes = db.prepare("SELECT userId, targetId, created_at FROM actions WHERE action = 'like' ORDER BY created_at DESC LIMIT 5").all();
      const lastMatches = db.prepare("SELECT user1, user2, created_at FROM matches ORDER BY created_at DESC LIMIT 5").all();
      const lastReports = db.prepare("SELECT userId, targetId, created_at FROM actions WHERE action = 'report' ORDER BY created_at DESC LIMIT 5").all();

      // --- SYSTEM / HOST ---
      const hostname = os.hostname();
      const platform = `${os.type()} ${os.release()} (${os.arch()})`;
      const cpuModel = os.cpus()[0].model;
      const cpuCount = os.cpus().length;
      const totalMem = Math.round(os.totalmem() / 1024 / 1024);
      const freeMem = Math.round(os.freemem() / 1024 / 1024);
      const memUsagePct = Math.round((1 - os.freemem() / os.totalmem()) * 100);
      const load = os.loadavg(); // 1,5,15
      const processUptime = Math.floor(process.uptime());
      const botUptime = Math.floor((Date.now() - (client.uptime ? (Date.now() - client.uptime) : Date.now())) / 1000);
      // note: client.uptime isn't exact in all versions; we'll also use processUptime

      // --- EMBEDS (séparés proprement) ---
      const embeds = [];

      // 1) Bot summary
      const botEmbed = new EmbedBuilder()
        .setColor(0x66ccff)
        .setTitle('🤖 Bot — Informations générales')
        .addFields(
          { name: 'Nom', value: botTag || 'N/A', inline: true },
          { name: 'ID', value: botId || 'N/A', inline: true },
          { name: 'Créé le', value: botCreatedAt ? `<t:${botCreatedAt}:d>` : 'N/A', inline: true },
          { name: 'Présence', value: `${presence}${activities.length ? ` — ${activities.join(', ')}` : ''}`, inline: true },
          { name: 'Uptime (process)', value: `${Math.floor(processUptime / 3600)}h ${(Math.floor(processUptime / 60) % 60)}m`, inline: true },
          { name: 'Ping WebSocket', value: `${wsPing} ms`, inline: true },
          { name: 'discord.js', value: discordJsVersion, inline: true },
          { name: 'Node.js', value: nodeVersion, inline: true },
          { name: 'Serveurs', value: `${guildCount}`, inline: true },
          { name: 'Total canaux (cache)', value: `${totalChannels}`, inline: true },
          { name: 'Membres (cache total)', value: `${totalMembers}`, inline: true }
        )
        .setTimestamp();
      embeds.push(botEmbed);

      // 2) Guild info (if applicable)
      if (interaction.guild) {
        const g = interaction.guild;
        const guildEmbed = new EmbedBuilder()
          .setColor(0x99ccff)
          .setTitle('🏰 Serveur — Informations')
          .setDescription(`${g.name}`)
          .setThumbnail(g.iconURL() || null)
          .addFields(
            { name: 'Serveur', value: `${g.name}`, inline: true },
            { name: 'ID', value: `${g.id}`, inline: true },
            { name: 'Propriétaire', value: `<@${g.ownerId}>`, inline: true },
            { name: 'Créé le', value: `<t:${Math.floor(g.createdTimestamp/1000)}:d>`, inline: true },
            { name: 'Membres totaux (cache)', value: `${g.memberCount ?? 'N/A'}`, inline: true },
            { name: 'Bots (approx)', value: `${totalBots}`, inline: true },
            { name: 'Rôles (cache)', value: `${g.roles.cache.size}`, inline: true },
            { name: 'Canaux (cache)', value: `${g.channels.cache.size}`, inline: true },
            { name: 'Emojis', value: `${g.emojis.cache.size}`, inline: true },
            { name: 'Boosts', value: `${g.premiumSubscriptionCount ?? 0}`, inline: true }
          )
          .setTimestamp();
        embeds.push(guildEmbed);
      }

      // 3) DB summary
      const dbEmbed = new EmbedBuilder()
        .setColor(0xffcc66)
        .setTitle('🗄️ Base de données — Statistiques')
        .addFields(
          { name: 'Fichier DB', value: path.basename(dbFilePath) || 'database.sqlite', inline: true },
          { name: 'Taille DB', value: dbFileSize, inline: true },
          { name: 'Profils enregistrés', value: `${totalProfiles}`, inline: true },
          { name: 'Likes totaux', value: `${totalLikes}`, inline: true },
          { name: 'Matchs (total)', value: `${totalMatches}`, inline: true },
          { name: 'Actions (total)', value: `${totalActions}`, inline: true },
          { name: 'Reports (total)', value: `${totalReports}`, inline: true },
          { name: 'Passes (total)', value: `${totalPasses}`, inline: true }
        )
        .setTimestamp();
      embeds.push(dbEmbed);

      // 4) Tops
      const topFields = [];
      topFields.push({ name: 'Top 5 — likés', value: topLiked.length ? topLiked.map(t => `${t.username ? `${t.username}` : `<@${t.userId}>`} — ❤️ ${t.likes}`).join('\n') : 'Aucun', inline: false });
      topFields.push({ name: 'Top 5 — matchés', value: topMatched.length ? topMatched.map(t => `<@${t.uid}> — ${t.cnt} match(s)`).join('\n') : 'Aucun', inline: false });
      topFields.push({ name: 'Top 5 — reportés', value: topReported.length ? topReported.map(t => `<@${t.userId}> — ${t.cnt} report(s)`).join('\n') : 'Aucun', inline: false });

      const topEmbed = new EmbedBuilder()
        .setColor(0xff99cc)
        .setTitle('🏆 Tops & Classements')
        .addFields(topFields)
        .setTimestamp();
      embeds.push(topEmbed);

      // 5) Derniers événements
      const lastFields = [];
      lastFields.push({ name: 'Derniers likes', value: lastLikes.length ? lastLikes.map(l => `<@${l.userId}> → <@${l.targetId}> <t:${Math.floor(l.created_at/1000)}:R>`).join('\n') : 'Aucun', inline: false });
      lastFields.push({ name: 'Derniers matchs', value: lastMatches.length ? lastMatches.map(m => `<@${m.user1}> ↔ <@${m.user2}> <t:${Math.floor(m.created_at/1000)}:R>`).join('\n') : 'Aucun', inline: false });
      lastFields.push({ name: 'Derniers reports', value: lastReports.length ? lastReports.map(r => `<@${r.userId}> → <@${r.targetId}> <t:${Math.floor(r.created_at/1000)}:R>`).join('\n') : 'Aucun', inline: false });

      const lastEmbed = new EmbedBuilder()
        .setColor(0xcccccc)
        .setTitle('🕘 Derniers événements (résumé)')
        .addFields(lastFields)
        .setTimestamp();
      embeds.push(lastEmbed);

      // 6) Système / Hôte
      const sysEmbed = new EmbedBuilder()
        .setColor(0x99ffcc)
        .setTitle('🖥️ Machine & Système')
        .addFields(
          { name: 'Hostname', value: hostname, inline: true },
          { name: 'Platform', value: platform, inline: true },
          { name: 'CPU', value: `${cpuModel} — ${cpuCount} coeurs`, inline: true },
          { name: 'RAM', value: `${freeMem}MB free / ${totalMem}MB total — ${memUsagePct}% utilisé`, inline: false },
          { name: 'LoadAvg (1,5,15)', value: `${load.map(n => n.toFixed(2)).join(', ')}`, inline: true },
          { name: 'Process uptime', value: `${Math.floor(processUptime/3600)}h ${(Math.floor(processUptime/60)%60)}m`, inline: true }
        )
        .setTimestamp();
      embeds.push(sysEmbed);

      // 7) Résumé global (petit tableau)
      const globalEmbed = new EmbedBuilder()
        .setColor(0x6699ff)
        .setTitle('🔎 Récapitulatif rapide')
        .addFields(
          { name: 'Serveurs (cache)', value: `${guildCount}`, inline: true },
          { name: 'Utilisateurs uniques (cache)', value: `${totalUsersUnique.size}`, inline: true },
          { name: 'Profils (DB)', value: `${totalProfiles}`, inline: true },
          { name: 'Likes (DB)', value: `${totalLikes}`, inline: true },
          { name: 'Matchs (DB)', value: `${totalMatches}`, inline: true },
        )
        .setTimestamp();
      embeds.push(globalEmbed);

      // Reply with embeds (ephemeral)
      // Discord limite souvent à 10 embeds, on s'assure de ne pas dépasser
      await interaction.reply({ embeds: embeds.slice(0, 10), ephemeral: true });

    } catch (err) {
      console.error('Erreur /botinfo:', err);
      return interaction.reply({ content: '❌ Une erreur est survenue lors de la génération des infos.', ephemeral: true });
    }
  }
};
