import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// Create a promise to open the DB
const dbPromise = open({
    filename: './Logging/database.sqlite',
    driver: sqlite3.Database
});

// Create tables on startup
dbPromise.then(async db => {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS warns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        moderatorId TEXT NOT NULL,
        reason TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS mutes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        moderatorId TEXT NOT NULL,
        reason TEXT NOT NULL,
        duration INTEGER NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);

    await db.exec(`CREATE TABLE IF NOT EXISTS users (
    userId TEXT,
    guildId TEXT,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    PRIMARY KEY (userId, guildId)
    )`
    );
});

// Database functions
export async function getUserAsync(userId, guildId) {
    const db = await dbPromise;

    const row = await db.get(`SELECT * FROM users WHERE userId = ? AND guildId = ?`, [userId, guildId]);

    if (row) return row;

    await db.run(`INSERT INTO users (userId, guildId, xp, level) VALUES (?, ?, 0, 0)`, [userId, guildId]);
    return { userId, guildId, xp: 0, level: 0 };
}


export async function updateUser(userId, guildId, xp, level) {
    const db = await dbPromise;
    await db.run(
        `UPDATE users SET xp=  ?, level = ? WHERE userId =? AND guildId =?`, [xp, level, userId, guildId]
    );
}


export async function addWarn(userId, moderatorId, reason) {
    const db = await dbPromise;
    return db.run(
        `INSERT INTO warns (userId, moderatorId, reason, timestamp) VALUES (?, ?, ?, ?)`,
        userId, moderatorId, reason, Date.now()
    );
}

export async function getWarns(userId) {
    const db = await dbPromise;
    return db.all(`SELECT * FROM warns WHERE userId = ? ORDER BY timestamp DESC`, userId);
}

export async function addMute(userId, moderatorId, reason, durationMs) {
    const db = await dbPromise;
    return db.run(
        `INSERT INTO mutes (userId, moderatorId, reason, duration, timestamp) VALUES (?, ?, ?, ?, ?)`,
        userId, moderatorId, reason, durationMs, Date.now()
    );
}

export async function getMutes(userId) {
    const db = await dbPromise;
    return db.all(`SELECT * FROM mutes WHERE userId = ? ORDER BY timestamp DESC`, userId);
}

export async function clearWarns(userId) {
    const db = await dbPromise;
    const result = await db.run('DELETE FROM warns WHERE userId = ?', userId);
    return result.changes > 0;
}
export async function saveUserAsync(userData) {
    const db = await dbPromise;
    if (!db) await init();

    // Insert or update user data
    await db.run(`
    INSERT INTO users (userId, guildId, xp, level) VALUES (?, ?, ?, ?)
    ON CONFLICT(userId, guildId) DO UPDATE SET
      xp = excluded.xp,
      level = excluded.level
  `, userData.userId, userData.guildId, userData.xp, userData.level);
}
