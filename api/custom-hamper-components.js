// FILE: api/custom-hamper-components.js
// This serverless function fetches the list of available items
// for the "Create Your Own Hamper" feature from Firestore.

import admin from 'firebase-admin';

// Initialize Firebase Admin SDK (it will reuse the existing initialization)
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase admin initialization error:', error.stack);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  // Set CORS headers
  

  try {
    const componentsRef = db.collection('custom_hamper_components');
    const snapshot = await componentsRef.get();

    if (snapshot.empty) {
      return res.status(404).json({ error: 'No hamper components found' });
    }

    const components = [];
    snapshot.forEach(doc => {
      components.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(components);
  } catch (error) {
    console.error('Error fetching hamper components from Firestore:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
