import Database from 'better-sqlite3';
import fs from 'node:fs'
import path from 'node:path'
// Open database
export const db = new Database('./Database/database.sqlite', {
  fileMustExist: true,
});


//load and execute schema from seperate sql file
const schemaPath = path.resolve('./Database/Schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');

db.exec(schema);


export default db;