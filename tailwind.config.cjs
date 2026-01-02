/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
  "./public/index.html",   // Look inside public
  "./public/app.js",       // Look inside public
  "./public/**/*.html"     // Look at everything else in public
],
  theme: {
    extend: {},
  },
  plugins: [],

}
