import { MongoClient } from 'mongodb';
const client = new MongoClient("mongodb://localhost:27017");
await client.connect().catch(error => { console.error("Failed to connect to MongoDB:", error); process.exit(1); });
export const appeals = client.db("Database").collection('appeals');
export const usersCollection = client.db("Database").collection('users');
export const counting = client.db("Database").collection('counting state')
export const bans = client.db("Database").collection("bans");
export const Invites = client.db("Database").collection("invites")
export const embedIDs = client.db("Database").collection("embedIDs")
export const applications = client.db("Database").collection("applications");
export const userTrackers = client.db("Database").collection("Usertrackers")
