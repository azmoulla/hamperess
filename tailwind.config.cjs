/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.{html,js}",          // <--- Scans index.html and app.js in the ROOT
    "./public/**/*.{html,js}" // <--- Scans any remaining files in public
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}