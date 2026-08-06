// FILE: public/firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyBzU9YCpen0fJ12eGSnLeQGXsavSa9kX3w",
  authDomain: "luxury-hampers-app.firebaseapp.com",
  projectId: "luxury-hampers-app",
  storageBucket: "luxury-hampers-app.firebasestorage.app",
  messagingSenderId: "314612428903",
  appId: "1:314612428903:web:3dca1b32342818124c2",
  measurementId: "G-LXPLK738BM"
};
const ALGOLIA_APP_ID = '2HPG7X4SK4'; // From your .env file
const ALGOLIA_SEARCH_KEY = 'c95f601b8e003e4a88624f0e3a1d8ad7'; // Your SEARCH-ONLY key
const PAYPAL_CLIENT_ID = 'BAAUovdvJGEsDfBUrY-TquXXhOCUAbzVmq_G3_lt5bxEywQ_4hDTJNpSH5Ixc56rPbiRpClxNTnpwhNPEE'; // Sandbox client ID, safe to expose (updated 2026-08-02, matches backend .env -- "Hampers" app under fresh sandbox business account, to avoid the COMPLIANCE_KYC_VIOLATION block on the old account)