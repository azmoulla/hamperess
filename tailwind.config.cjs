/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/**/*.html",  // <--- This scans your HTML files in public
    "./public/**/*.js"     // <--- This scans your JS files in public
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}