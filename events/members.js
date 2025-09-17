// src/events/members.js
const { db } = require("../utils/db");

function saveMember(member, left = false) {
  try {
    const user = member.user;
    const roles = member.roles.cache.map(r => r.id).join(",");

    db.prepare(`
      INSERT INTO members (
        userId, username, global_name, discriminator, avatar, banner,
        public_flags, locale, nick, roles, joined_at, left_at,
        premium_since, permissions, communication_disabled_until
      ) VALUES (
        @userId, @username, @global_name, @discriminator, @avatar, @banner,
        @public_flags, @locale, @nick, @roles, @joined_at, @left_at,
        @premium_since, @permissions, @communication_disabled_until
      )
      ON CONFLICT(userId) DO UPDATE SET
        username = excluded.username,
        global_name = excluded.global_name,
        discriminator = excluded.discriminator,
        avatar = excluded.avatar,
        banner = excluded.banner,
        public_flags = excluded.public_flags,
        locale = excluded.locale,
        nick = excluded.nick,
        roles = excluded.roles,
        joined_at = excluded.joined_at,
        left_at = excluded.left_at,
        premium_since = excluded.premium_since,
        permissions = excluded.permissions,
        communication_disabled_until = excluded.communication_disabled_until
    `).run({
      userId: user.id,
      username: user.username || null,
      global_name: user.globalName || null,
      discriminator: user.discriminator || null,
      avatar: user.displayAvatarURL({ size: 1024, extension: "png" }) || null,
      banner: user.banner || null,
      public_flags: user.publicFlags ?? null,
      locale: user.locale || null,
      nick: member.nickname || null,
      roles,
      joined_at: member.joinedTimestamp || null,
      left_at: left ? Date.now() : null,
      premium_since: member.premiumSinceTimestamp || null,
      permissions: member.permissions?.bitfield?.toString() || null,
      communication_disabled_until: member.communicationDisabledUntilTimestamp || null,
    });
  } catch (e) {
    console.error("Erreur saveMember:", e);
  }
}

module.exports = (client) => {
  // Quand un membre rejoint
  client.on("guildMemberAdd", (member) => {
    saveMember(member, false);
    console.log(`✅ Nouveau membre enregistré: ${member.user.tag}`);
  });

  // Quand un membre met à jour son profil (pseudo, rôles, etc.)
  client.on("guildMemberUpdate", (oldMember, newMember) => {
    saveMember(newMember, false);
    console.log(`✏️ Membre mis à jour: ${newMember.user.tag}`);
  });

  // Quand un membre quitte
  client.on("guildMemberRemove", (member) => {
    saveMember(member, true);
    console.log(`❌ Membre parti: ${member.user.tag}`);
  });
};
