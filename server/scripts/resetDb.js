/**
 * resetDb.js — Drops all collections so the app starts fresh.
 * Run: node scripts/resetDb.js (from any directory)
 */
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI not found in .env');
  process.exit(1);
}

await mongoose.connect(MONGO_URI);
console.log('✅ Connected to MongoDB:', mongoose.connection.host);

const db = mongoose.connection.db;
const collections = await db.listCollections().toArray();

if (collections.length === 0) {
  console.log('ℹ️  No collections found — DB is already empty.');
} else {
  for (const col of collections) {
    await db.collection(col.name).drop();
    console.log(`🗑  Dropped: ${col.name}`);
  }
  console.log('\n✅ All collections dropped. Fresh start!');
}

await mongoose.disconnect();
process.exit(0);
