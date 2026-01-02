/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",            // Scans index.html in Root
    "./app.js",                // Scans app.js in Root
    "./public/**/*.{html,js}"  // Scans any leftovers in public
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}