import db from './database.js';

// ───── USER XP/LEVEL SYSTEM ─────

export function getUser(userId) {
  // Ensure user exists
  db.prepare(`
    INSERT OR IGNORE INTO users (userId, xp, level, points)
    VALUES (?,0, 1, 100)
  `).run(userId);

  const userData = db.prepare(`
    SELECT * FROM users WHERE userId = ?
  `).get(userId);

  const allUsers = db.prepare(`
    SELECT * FROM users WHERE userId is not null
  `).all();

  return { userData, allUsers };
}


export function saveUser({ userId, xp, level, points }) {
  db.prepare(`
    INSERT INTO users (userId, xp, level, points)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(userId) DO UPDATE SET xp = excluded.xp, level = excluded.level, points = excluded.points
  `).run(userId, xp, level, points);
}
// ───── NOTES ─────

export function addNote({ userId, moderatorId, note }) {
  db.prepare(`INSERT INTO notes (userId, moderatorId, note, timestamp)
    VALUES (?,?,?,?)`).run(userId, moderatorId, note, Date.now())
}

export function viewNotes(userId) {
  const rows = db.prepare(`SELECT * FROM notes
    WHERE userId = ? 
    ORDER BY timestamp DESC
    `).all(userId)
  return Array.isArray(rows) ? rows : [];
}

export function deleteNote(id) {
  db.prepare(`DELETE FROM notes WHERE id = ?
`).run(id);
}

// ───── WARNS ─────

export function addWarn(userId, moderatorId, reason, weight, channel) {
  return db.prepare(`
    INSERT INTO punishments (userId, moderatorId, reason, timestamp, active, weight, type, channel)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, moderatorId, reason, Date.now(), 1, weight, 'Warn', channel);
}

export async function getPunishments(userId) {
  const rows = db.prepare(`
    SELECT * FROM punishments WHERE userId = ?  ORDER BY timestamp DESC
  `).all(userId);
  return Array.isArray(rows) ? rows : [];
}

export async function getActiveWarns(userId) {
  const rows = db.prepare(`
    SELECT * FROM punishments WHERE userId = ? AND active = 1 ORDER BY timestamp DESC
  `).all(userId);
  return Array.isArray(rows) ? rows : [];
}

// ───── MUTES ─────

export function addMute(userId, moderatorId, reason, durationMs, weight, channel) {
  return db.prepare(`
    INSERT INTO punishments (userId, moderatorId, reason, duration, timestamp, active, weight, type, channel)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, moderatorId, reason, durationMs, Date.now(), 1, weight, 'Mute', channel);
}

//───── Admin ─────

export function clearmodlogs(userId) {
  db.prepare(`DELETE FROM punishments WHERE userId = ?`).run(userId);
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

export function deleteMute(id) {
  db.prepare(`
    DELETE FROM punishments WHERE id = ? AND type = 'Mute'
  `).run(id);
}