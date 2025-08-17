PRAGMA foreign_keys = ON;

PRAGMA journal_mode = DELETE;

CREATE TABLE
    IF NOT EXISTS punishments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        moderatorId TEXT NOT NULL,
        reason TEXT NOT NULL,
        type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        duration INTEGER,
        active INTEGER DEFAULT 1,
        weight INTEGER DEFAULT 1,
        channel TEXT NOT NULL,
        guildId TEXT NOT NULL,
        FOREIGN KEY (userId, guildId) REFERENCES users (userId, guildId)
    );

CREATE TABLE
    IF NOT EXISTS users (
        userId TEXT NOT NULL,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        coins INTEGER DEFAULT 100,
        guildId TEXT NOT NULL,
        PRIMARY KEY (userId, guildId)
    );

CREATE TABLE
    IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        moderatorId TEXT NOT NULL,
        note TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        guildId TEXT NOT NULL,
        FOREIGN KEY (userId, guildId) REFERENCES users (userId, guildId)
    );

CREATE INDEX IF NOT EXISTS idx_userid_levels_xp_coins ON users (level DESC, xp DESC);

CREATE INDEX IF NOT EXISTS idx_userid_guildId_timestamp_active_punishments ON punishments (userId, guildId, active, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_userId_guildId_timestamp_notes ON notes (userId, guildId, timestamp DESC);