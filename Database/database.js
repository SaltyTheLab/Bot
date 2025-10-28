import { MongoClient } from 'mongodb';
let db;
async function connectToMongoDB() {
  try {
    const client = new MongoClient("mongodb://localhost:27017");
    await client.connect();
    console.log("Connected to MongoDB successfully!");
    db = client.db("Database");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
}
await connectToMongoDB()
export default db;