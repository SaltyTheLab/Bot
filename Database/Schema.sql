
CREATE TABLE IF NOT EXISTS punishments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT  NOT NULL,
    moderatorId TEXT NOT NULL,
    reason TEXT NOT NULL,
    type TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    duration INTEGER,
    active INTEGER DEFAULT 1,
    weight INTEGER DEFAULT 1,
    channel TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(userId)
);

CREATE TABLE IF NOT EXISTS users (
    userId TEXT,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    coins INTEGER DEFAULT 100,
    PRIMARY KEY (userId)
);

CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    moderatorId TEXT NOT NULL,
    note TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(userId)
);

DROP INDEX IF EXISTS idx_users_userId;
DROP INDEX IF EXISTS idx_punishments_user_type;
DROP INDEX IF EXISTS idx_punishments_user_active;
