// FILE: scripts/index-to-algolia.js (Final, Hybrid-Read Version)
import admin from 'firebase-admin';
import algoliasearch from 'algoliasearch';
import { readFileSync } from 'fs';
import 'dotenv/config'; // Loads your ALGOLIA keys from .env.local

// --- INITIALIZATION ---
try {
  // THIS IS THE FIX: Read the service account key directly from the JSON file.
  const serviceAccount = JSON.parse(readFileSync('./firebase-service-account.json'));

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
} catch (error) {
  console.error('CRITICAL: Firebase admin initialization failed. Ensure firebase-service-account.json is in your project root.', error);
  process.exit(1);
}

const algoliaClient = algoliasearch(
  process.env.ALGOLIA_APP_ID,
  process.env.ALGOLIA_ADMIN_API_KEY
);
const db = admin.firestore();
const index = algoliaClient.initIndex('products');

// --- MAIN SCRIPT LOGIC ---
async function indexData() {
  try {
    console.log('Fetching products from Firestore...');
    const snapshot = await db.collection('products').get();

    if (snapshot.empty) {
      console.log('No products found to index.');
      return;
    }

    const records = snapshot.docs.map(doc => ({
      objectID: doc.id,
      ...doc.data()
    }));

    console.log(`Found ${records.length} products. Uploading to Algolia...`);
    await index.saveObjects(records);
    console.log(`✅ Successfully indexed ${records.length} products.`);

  } catch (error) {
    console.error('❌ Error during indexing process:', error);
  }
}

indexData();