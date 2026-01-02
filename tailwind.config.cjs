/** @type {import('tailwindcss').Config} */
module.exports = {
content: [
    "./index.html",          // 1. Matches index.html in the root
    "./*.js",                // 2. Matches all JS files in the root (app.js, auth.js, etc.) but NOT subfolders
    "./public/**/*.html"     // 3. Matches any HTML files still inside public
  ],
  theme: {
    extend: {},
  },
  plugins: [],

}


