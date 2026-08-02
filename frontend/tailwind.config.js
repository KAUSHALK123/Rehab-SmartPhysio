/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#3B82F6", // Medical Blue
        secondary: "#10B981", // Emerald Green
        accent: "#06B6D4", // Cyan
      }
    },
  },
  plugins: [],
}
