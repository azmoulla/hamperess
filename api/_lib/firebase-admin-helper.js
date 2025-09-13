import admin from 'firebase-admin';

// Initialize Firebase Admin SDK only once
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

// Get the db and auth instances once and export them for other files to use
export const db = admin.firestore();
export const auth = admin.auth();

/**
 * Verifies the user's token and checks if they have admin privileges in Firestore.
 * @param {object} req - The incoming request object.
 * @returns {Promise<boolean>} True if the user is a verified admin.
 */
export async function verifyAdmin(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
    
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();
        return userDoc.exists && userDoc.data().isAdmin === true;
    } catch (error) {
        console.error('Admin verification error:', error);
        return false;
    }
}