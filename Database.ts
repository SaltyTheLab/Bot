import { MongoClient } from 'mongodb';
const client = new MongoClient("mongodb://localhost:27017");
await client.connect().catch(error => { console.error("Failed to connect to MongoDB:", error); process.exit(1); });
const usersCollection = client.db("Database").collection('users');
const guildconfigs = client.db("Database").collection("guildconfigs")
const logos = client.db("Database").collection("logos")
export { usersCollection, guildconfigs, logos }