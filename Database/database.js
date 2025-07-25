import Database from 'better-sqlite3';

// Open database
export const db = new Database('./Database/database.sqlite', {
  fileMustExist: true,
});


// Initialize tables
// Define schema
const tableSchemas = [
  `CREATE TABLE IF NOT EXISTS punishments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    moderatorId TEXT NOT NULL,
    reason TEXT NOT NULL,
    type TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    duration INTEGER,
    active INTEGER DEFAULT 1,
    weight INTEGER DEFAULT 1,
    channel TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS users (
    userId TEXT,
    guildId TEXT,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    PRIMARY KEY (userId, guildId)
  )`,

  `CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,
  moderatorId TEXT NOT NULL,
  note TEXT NOT NULL,
  timestamp INTEGER NOT NULL)`
];

// Create tables
for (const schema of tableSchemas) {
  db.exec(schema);
}

// Create indexes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_user_guild ON users(userId, guildId);
  CREATE INDEX IF NOT EXISTS idx_punishments_user_type ON punishments(userId, type);
  CREATE INDEX IF NOT EXISTS idx_punishments_user_active ON punishments(userId, active);
`);

export default db;