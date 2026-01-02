/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",          // <--- Scans your main HTML file
    "./app.js",              // <--- Scans your main JS file
    "./public/**/*.{html,js}" // <--- Scans any extra files in public
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}