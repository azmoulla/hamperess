// FILE: api/products.js
// This is your Vercel Serverless Function for fetching products.
// It connects securely to your Firebase database to get the main product list.

import admin from 'firebase-admin';

// This is the secret service account key you downloaded from Firebase.
// It will be read from the Vercel Environment Variable you configured.
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

// Initialize the Firebase Admin SDK, but only if it hasn't been already.
// This prevents re-initialization on subsequent function calls.
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase admin initialization error:', error.stack);
  }
}

const db = admin.firestore();

// This is the main function Vercel will run when a browser visits /api/products
export default async function handler(req, res) {
  // Set CORS headers to allow your frontend (on any domain) to call this API.
  // This is a standard security requirement for APIs.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  // Vercel requires handling the OPTIONS method for CORS pre-flight requests.
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get a reference to the 'products' collection in your Firestore database.
    const productsRef = db.collection('products');
    const snapshot = await productsRef.get();

    if (snapshot.empty) {
      console.log('No product documents found in Firestore.');
      return res.status(404).json({ error: 'No products found' });
    }

    // Loop through the documents and create an array of product data.
    const products = [];
    snapshot.forEach(doc => {
      products.push({ id: doc.id, ...doc.data() });
    });

    // Send the array of products back to the frontend as JSON data.
    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products from Firestore:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}