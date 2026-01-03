// FILE: auth.js
// This file replaces the localStorage-based authentication with a secure,
// live connection to Firebase Authentication.

window.auth = (() => {



    // Initialize Firebase
    console.log('--- DEFINITIVE TEST: firebaseConfig object ---');
    console.log(firebaseConfig);
    firebase.initializeApp(window.firebaseConfig);
    const fbAuth = firebase.auth();
    const db = firebase.firestore();

    let currentUser = null;

    // Listen for real-time authentication changes
   fbAuth.onAuthStateChanged(async user => { // Made this function async
    if (user) {
        // User is signed in.
        try {
            // 1. Get the user's profile from Firestore.
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                currentUser = { uid: user.uid, email: user.email, ...userDoc.data() };
            } else {
                currentUser = { uid: user.uid, email: user.email, name: user.displayName || user.email };
            }
            console.log("Firebase Auth: User is signed in:", currentUser.name);

            // 2. The local cart (from when they were a guest).
           const localCartString = localStorage.getItem('luxuryHampersCart');
            let localCart = []; // Default to an empty array

            if (localCartString) {
                try {
                    const parsedData = JSON.parse(localCartString);
                    const now = new Date().getTime();

                    // Check if it's the NEW object format { cart: [], expires: ... }
                    if (parsedData && typeof parsedData === 'object' && Array.isArray(parsedData.cart)) {
                        // Check if the cart has expired
                        if (!parsedData.expires || now <= parsedData.expires) {
                            localCart = parsedData.cart; // Extract the actual cart array
                            console.log("auth.js: Loaded local cart (new format):", localCart.length, "items");
                        } else {
                            console.log("auth.js: Found expired local cart, clearing.");
                            localStorage.removeItem('luxuryHampersCart'); // Clear expired cart
                        }
                    }
                    // Check if it's the OLD format (just an array) for backward compatibility
                    else if (Array.isArray(parsedData)) {
                        localCart = parsedData; // Use the old array directly
                        console.log("auth.js: Loaded local cart (old format):", localCart.length, "items");
                        // Optionally re-save in new format here if needed
                    }
                    // Handle corrupted data
                    else {
                         console.warn("auth.js: Local cart data is invalid format. Clearing.");
                         localStorage.removeItem('luxuryHampersCart');
                    }

                } catch (error) {
                    console.error("Error parsing local cart in auth.js:", error);
                    localStorage.removeItem('luxuryHampersCart'); // Clear corrupted data
                }
            } else {
                 console.log("auth.js: No local cart found in localStorage.");
            }

            // 3. The remote cart (saved in their profile).
            const remoteCart = currentUser.cart || [];
            console.log("auth.js: Remote cart:", remoteCart.length, "items");

            // 4. Merge the carts: Combine both, giving precedence to remote items if duplicates exist.
            const mergedCart = [...remoteCart]; // Start with the remote cart

            // --- SAFETY CHECK ADDED ---
            if (Array.isArray(localCart) && localCart.length > 0) {
                 console.log("auth.js: Merging local cart items into remote cart...");
                localCart.forEach(localItem => { // This line (previously line 40) should now work
                    // Only add local item if an item with the same ID isn't already in mergedCart (from remote)
                    if (!mergedCart.some(mergedItem => mergedItem.id === localItem.id)) {
                        mergedCart.push(localItem);
                    }
                });
            } else {
                 console.log("auth.js: No valid local cart items to merge.");
            }
            console.log("auth.js: Merged cart:", mergedCart.length, "items");
            
            // 5. Update localStorage with the definitive merged cart.
            localStorage.setItem('luxuryHampersCart', JSON.stringify(mergedCart));

        } catch (error) {
            console.error("Error during auth state change:", error);
            currentUser = { uid: user.uid, email: user.email, name: user.displayName || user.email };
        } finally {
            // 6. Notify the app that authentication is complete.
            window.dispatchEvent(new Event('authchange'));
        }
    } else {
        // User is signed out.
        currentUser = null;
        console.log("Firebase Auth: User is signed out.");
         // Clear the local cart from storage when the user logs out.
        localStorage.removeItem('luxuryHampersCart');
        window.dispatchEvent(new Event('authchange'));
    }
});

    return {

        isVerified() {
    const user = fbAuth.currentUser;
    return user ? user.emailVerified : false;
},

    // REPLACE the existing changePassword function in your public/auth.js with this DIAGNOSTIC version.

       // REPLACE the existing changePassword function in your public/auth.js file with this FINAL version.

        // Securely changes the user's password with robust and accurate error handling
        async changePassword(currentPassword, newPassword) {
            if (!this.isLoggedIn()) {
                return { success: false, message: "You must be logged in to change your password." };
            }

            const user = fbAuth.currentUser;
            const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);

            try {
                // Re-authenticate the user to confirm their identity
                await user.reauthenticateWithCredential(credential);
                
                // If re-authentication is successful, update the password
                await user.updatePassword(newPassword);
                
                return { success: true };

            } catch (error) {
                // Log the full error to the console for detailed debugging
                console.error("Password Change Error:", error);

                // --- THIS IS THE FINAL, ROBUST LOGIC ---
                // We now check for all possible error codes for an incorrect password.
                if (error.code === 'auth/wrong-password' || 
                    error.code === 'auth/invalid-credential' ||
                    error.code === 'auth/invalid-login-credentials') // ADDED: The new, correct error code we discovered
                {
                    // This is the most common error. Give a specific, helpful message.
                    return { success: false, message: "The current password you entered is incorrect. Please try again." };
                } 
                else if (error.code === 'auth/weak-password') {
                    // Firebase has built-in password strength validation.
                    return { success: false, message: "The new password is too weak. It must be at least 6 characters long." };
                } 
                else {
                    // For any other unexpected error (e.g., network down), provide a clear but safe default.
                    return { success: false, message: "An unexpected error occurred. Please check your connection and try again." };
                }
            }
        },
        // Registers a new user with email/password
       // THIS IS THE NEW, CORRECTED CODE
async register(name, email, password) {
    try {
        const userCredential = await fbAuth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Trigger the Firebase email verification process.
        await user.sendEmailVerification();
        
        // Set the user's display name in Firebase Auth
        await user.updateProfile({ displayName: name });

        // Create a user profile document in Firestore
        await db.collection('users').doc(user.uid).set({
            name: name,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Manually update the local currentUser object to prevent race conditions.
        currentUser = { uid: user.uid, email: user.email, name: name };
        
        // Manually trigger the authchange event to update the UI instantly.
        window.dispatchEvent(new Event('authchange'));

        return { success: true };
    } catch (error) {
        console.error("Firebase Registration Error:", error);
        return { success: false, message: error.message };
    }
},
        // Logs in a user // Logs in a user with robust error handling
        async login(email, password) {
            try {
                await fbAuth.signInWithEmailAndPassword(email, password);
                return { success: true };
            } catch (error) {
                console.error("Firebase Login Error:", error);
                
                // --- THIS IS THE NEW, ROBUST LOGIC ---
                // Check for the specific error code and return a user-friendly message.
                if (error.code === 'auth/invalid-login-credentials' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                    return { success: false, message: "Login failed. Please check your email and password." };
                } else {
                    // For any other error, provide a generic message.
                    return { success: false, message: "An unexpected error occurred. Please try again." };
                }
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
                const user = fbAuth.currentUser;
                const userDocRef = db.collection('users').doc(currentUser.uid);

                // --- THIS IS THE FIX ---
                // We use .set() with { merge: true } instead of .update().
                // If the document exists, it updates the name field.
                // If the document does NOT exist, it creates it and sets the name field.
                await userDocRef.set({
                    name: details.name
                }, { merge: true });
                
                // Also update the display name in Firebase Auth itself for consistency
                if (user.displayName !== details.name) {
                    await user.updateProfile({ displayName: details.name });
                }

                // Optimistically update local user object
                currentUser.name = details.name;
                window.dispatchEvent(new Event('authchange')); // This will update the header
                
                return { success: true };

            } catch (error) {
                console.error("Firestore Update Error:", error);
                return { success: false, message: error.message };
            }
        }
    };

})();

