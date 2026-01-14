// FILE: api/_lib/firebase-admin-helper.js (Correct and Final Version)
import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('CRITICAL: Firebase admin initialization failed:', error);
    throw new Error('Firebase admin initialization failed. Check FIREBASE_SERVICE_ACCOUNT_KEY environment variable.');
  }
}

export const db = admin.firestore();
export const auth = admin.auth();

export async function verifyAdmin(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
    
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();
        return userDoc.exists && userDoc.data().isAdmin === true;
    } catch (error) {
        console.error("Error during admin verification:", error);
        return false;
    }
}