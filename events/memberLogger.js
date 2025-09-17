// src/events/memberLogger.js
const { Events } = require("discord.js");
const { db } = require("../utils/db");

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const user = member.user;

    db.prepare(`
      INSERT OR REPLACE INTO members (
        userId, username, global_name, discriminator, avatar, banner,
        public_flags, locale, nick, roles, joined_at, premium_since,
        permissions, communication_disabled_until
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      user.username,
      user.globalName,
      user.discriminator,
      user.avatar,
      user.banner,
      user.flags?.bitfield || 0,
      user.locale || null,
      member.nickname || null,
      member.roles.cache.map(r => r.name).join(", ") || null,
      Math.floor(member.joinedTimestamp),
      member.premiumSinceTimestamp || null,
      member.permissions?.toArray().join(", ") || null,
      member.communicationDisabledUntilTimestamp || null
    );
  },
};
