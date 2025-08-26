import { MongoClient } from 'mongodb';

const uri = "mongodb://localhost:27017";

const dbName = "Database";

let db;
let client;

async function connectToMongoDB() {
  if (db) {
    return db
  }

  try {
    client = new MongoClient(uri);
    await client.connect();
    console.log("Connected to MongoDB successfully!");
    db = client.db(dbName);
    return db;
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
}
export default connectToMongoDB;