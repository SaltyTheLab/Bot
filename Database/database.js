import Database from 'better-sqlite3';
import fs from 'node:fs'
import path from 'node:path'
// Open database
export const db = new Database('./Database/database.sqlite', {
  fileMustExist: true,
});

db.pragma('foreign_keys = ON')
db.pragma('journal_mode=DELETE')
//load and execute schema from seperate sql file
const schemaPath = path.resolve('./Database/Schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');
const statements = schema.split(';').filter(stmt => stmt.trim() !== '');
//run the schema of the database
for (const stmt of statements){
  try {
    db.exec(stmt + ';');
  }catch (error){
    console.error(`error exectuing schema statement: ${stmt.trim()}`);
    console.error(error);
    throw error;
  }
}
//export default open database for database functions
export default db;