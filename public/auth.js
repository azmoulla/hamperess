// FILE: auth.js
// This file is now powered by Firebase Authentication for secure, real-time user management.

const auth = (() => {
    // --- IMPORTANT ---
    // PASTE YOUR FIREBASE CONFIG OBJECT HERE
    // You copied this from the Firebase console in Step 1.
    const firebaseConfig = {
      apiKey: "AIzaSyBzU9YCpen0fJ12eGSnLeQGXsavSa9kX3w", // Replace with your actual apiKey
      authDomain: "luxury-hampers-app.firebaseapp.com", // Replace
      projectId: "luxury-hampers-app", // Replace
      storageBucket: "luxury-hampers-app.firebasestorage.app", // Replace
      messagingSenderId: "314612428903", // Replace
      appId: "1:314612428903:web:39c34c1d63e0aa818124c2",// Replace
      measurementId: "G-LXPLK738BM"
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const fbAuth = firebase.auth();
    let currentUser = null;

    // Listen for real-time authentication changes
    fbAuth.onAuthStateChanged(user => {
        if (user) {
            // User is signed in. We can create a simplified object for our app's use.
            currentUser = {
                uid: user.uid,
                email: user.email,
                name: user.displayName || user.email.split('@')[0] // Use display name or derive from email
            };
            console.log("Firebase Auth: User is signed in.", currentUser);
        } else {
            // User is signed out.
            currentUser = null;
            console.log("Firebase Auth: User is signed out.");
        }
        // Notify the rest of the app that the auth state has changed
        window.dispatchEvent(new Event('authchange'));
    });

    return {
        async register(name, email, password) {
            try {
                const userCredential = await fbAuth.createUserWithEmailAndPassword(email, password);
                // After creation, update the user's profile with their name
                await userCredential.user.updateProfile({ displayName: name });
                // Manually update our local currentUser object after profile update
                currentUser = {
                    uid: userCredential.user.uid,
                    email: userCredential.user.email,
                    name: name
                };
                return true;
            } catch (error) {
                console.error("Firebase Registration Error:", error);
                showConfirmationModal(error.message); // Show the actual Firebase error
                return false;
            }
        },

        async login(email, password) {
            try {
                await fbAuth.signInWithEmailAndPassword(email, password);
                return true;
            } catch (error) {
                console.error("Firebase Login Error:", error);
                showConfirmationModal(error.message); // Show the actual Firebase error
                return false;
            }
        },

        logout() {
            fbAuth.signOut();
        },

        isLoggedIn() {
            return currentUser !== null;
        },

        getUserName() {
            return currentUser ? currentUser.name : '';
        },

        getUserEmail() {
            return currentUser ? currentUser.email : '';
        },

        getCurrentUser() {
            return currentUser;
        },

        async updateUser(details) {
            if (!fbAuth.currentUser) return false;
            try {
                await fbAuth.currentUser.updateProfile({ displayName: details.name });
                await fbAuth.currentUser.updateEmail(details.email);
                // Manually update local state after successful update
                 currentUser.name = details.name;
                 currentUser.email = details.email;
                window.dispatchEvent(new Event('authchange'));
                return true;
            } catch(error) {
                 console.error("Firebase Update User Error:", error);
                 showConfirmationModal(error.message);
                 return false;
            }
        }
    };
})();
