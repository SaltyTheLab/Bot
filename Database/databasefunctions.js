// db-layer.js
import db from './database.js';

// ───── USER XP/LEVEL SYSTEM ─────

// databasefunctions.js
export function getUser(userId, guildId) {
    // Ensure user exists
    db.prepare(`
    INSERT OR IGNORE INTO users (userId, guildId, xp, level)
    VALUES (?, ?, 0, 1)
  `).run(userId, guildId);

    const userData = db.prepare(`
    SELECT * FROM users WHERE userId = ? AND guildId = ?
  `).get(userId, guildId);

    const allUsers = db.prepare(`
    SELECT * FROM users WHERE guildId = ?
  `).all(guildId);

    return { userData, allUsers };
}


export function updateUser(userId, guildId, xp, level) {
    db.prepare(`
    UPDATE users SET xp = ?, level = ? WHERE userId = ? AND guildId = ?
  `).run(xp, level, userId, guildId);
}

export function saveUser({ userId, guildId, xp, level }) {
    db.prepare(`
    INSERT INTO users (userId, guildId, xp, level)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(userId, guildId) DO UPDATE SET xp = excluded.xp, level = excluded.level
  `).run(userId, guildId, xp, level);
}

// ───── WARNS ─────

export function addWarn(userId, moderatorId, reason, weight = 1, type = 'Warn') {
    return db.prepare(`
    INSERT INTO punishments (userId, moderatorId, reason, timestamp, active, weight, type)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `).run(userId, moderatorId, reason, Date.now(), weight, type);
}

export function getWarns(userId) {
    const rows = db.prepare(`
    SELECT * FROM punishments WHERE userId = ? AND type = 'Warn' ORDER BY timestamp DESC
  `).all(userId);

    return Array.isArray(rows) ? rows : [];
}

export function getActiveWarns(userId) {

    const rows = db.prepare(`
    SELECT * FROM punishments WHERE userId = ? AND active = 1 ORDER BY timestamp DESC
  `).all(userId);

  return Array.isArray(rows) ? rows : [];
}


export function clearActiveWarns(userId) {
    const result = db.prepare(`
    UPDATE punishments SET active = 0 WHERE userId = ? AND active = 1 AND type = 'Warn'
  `).run(userId);
    return result.changes > 0;
}

export function deleteWarn(id) {
    db.prepare(`DELETE FROM punishments WHERE id = ? AND type = 'Warn'`).run(id);
}

// ───── MUTES ─────

export function addMute(userId, moderatorId, reason, durationMs, weight = 1, type = 'Mute') {
    return db.prepare(`
    INSERT INTO punishments (userId, moderatorId, reason, duration, timestamp, active, weight, type)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `).run(userId, moderatorId, reason, durationMs, Date.now(), weight, type);
}

export function getMutes(userId) {
    return db.prepare(`
    SELECT * FROM punishments WHERE userId = ? AND type = 'Mute' ORDER BY timestamp DESC
  `).all(userId);
}

export function deleteMute(id) {
    db.prepare(`
    DELETE FROM punishments WHERE id = ? AND type = 'Mute'
  `).run(id);
}

//───── Misc ─────

export function clearmodlogs(userId) {
  db.prepare(`DELETE FROM punishments WHERE userId = ?`).run(userId);
  console.log(`✅ Cleared moderation tables for user: ${userId}`);
}

