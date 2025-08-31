// FILE: auth.js
// This file replaces the localStorage-based authentication with a secure,
// live connection to Firebase Authentication.

const auth = (() => {
    // --- IMPORTANT ACTION REQUIRED ---
    // PASTE YOUR FIREBASE CONFIG OBJECT HERE
    const firebaseConfig = {
    apiKey: "AIzaSyBzU9YCpen0fJ12eGSnLeQGXsavSa9kX3w",
    authDomain: "luxury-hampers-app.firebaseapp.com",
    projectId: "luxury-hampers-app",
    storageBucket: "luxury-hampers-app.firebasestorage.app",
    messagingSenderId: "314612428903",
    appId: "1:314612428903:web:39c34c1d63e0aa818124c2",
    measurementId: "G-LXPLK738BM"
  };


    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const fbAuth = firebase.auth();
    const db = firebase.firestore();

    let currentUser = null;

    // Listen for real-time authentication changes
    fbAuth.onAuthStateChanged(user => {
        if (user) {
            // User is signed in, get their profile from Firestore
            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    currentUser = { uid: user.uid, email: user.email, ...doc.data() };
                } else {
                    // This case handles users who signed up but their profile wasn't created yet
                    currentUser = { uid: user.uid, email: user.email, name: user.displayName || user.email };
                }
                console.log("Firebase Auth: User is signed in:", currentUser.name);
                window.dispatchEvent(new Event('authchange'));
            });
        } else {
            // User is signed out
            currentUser = null;
            console.log("Firebase Auth: User is signed out.");
            window.dispatchEvent(new Event('authchange'));
        }
    });

    return {
        // Registers a new user with email/password
        async register(name, email, password) {
            try {
                const userCredential = await fbAuth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;

                // Set the user's display name in Firebase Auth
                await user.updateProfile({ displayName: name });

                // Create a user profile document in Firestore
                await db.collection('users').doc(user.uid).set({
                    name: name,
                    email: email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                return { success: true };
            } catch (error) {
                console.error("Firebase Registration Error:", error);
                return { success: false, message: error.message };
            }
        },

        // Logs in a user
        async login(email, password) {
            try {
                await fbAuth.signInWithEmailAndPassword(email, password);
                return { success: true };
            } catch (error) {
                console.error("Firebase Login Error:", error);
                return { success: false, message: error.message };
            }
        },

        // Logs out the current user
        logout() {
            fbAuth.signOut();
        },

        // Checks if a user is currently logged in
        isLoggedIn() {
            return currentUser !== null;
        },

        // Gets the current user's name
        getUserName() {
            return currentUser ? currentUser.name : '';
        },
        
        // Gets the current user object
        getCurrentUser() {
            return currentUser;
        },

        // Updates user details in Firestore
        async updateUser(details) {
            if (!this.isLoggedIn()) return { success: false, message: "User not logged in." };
            
            try {
                const userDocRef = db.collection('users').doc(currentUser.uid);
                await userDocRef.update({
                    name: details.name
                    // Note: Email updates require re-authentication and are more complex.
                    // We will only update the name for now.
                });
                // Optimistically update local user object
                currentUser.name = details.name;
                window.dispatchEvent(new Event('authchange'));
                return { success: true };
            } catch (error) {
                console.error("Firestore Update Error:", error);
                return { success: false, message: error.message };
            }
        }
    };
})();