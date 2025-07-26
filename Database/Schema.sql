CREATE TABLE IF NOT EXISTS punishments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    moderatorId TEXT NOT NULL,
    reason TEST NOT NULL,
    type TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    duration INTEGER,
    active INTEGER DEFAULT 1,
    weight INTEGER DEFAULT 1,
    channel TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    userId TEXT,
    guildId TEXT,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    PRIMARY KEY (userId, guildId)
);

CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    moderatorId TEXT NOT NULL,
    note TEXT NOT NULL,
    timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_guild ON users(userId, guildId);
CREATE INDEX IF NOT EXISTS idx_punishments_user_type ON punishments(userId, type);
CREATE INDEX IF NOT EXISTS idx_punishments_user_active ON punishments(userId, active);
