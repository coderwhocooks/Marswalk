/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mars: {
          dark: '#0B0D13',
          panel: '#121620',
          border: '#232A3B',
          red: '#D85A38',
          orange: '#F28500',
          rust: '#A03823',
          accent: '#38BDF8',
          subtle: '#64748B',
          text: '#F1F5F9',
        }
      }
    },
  },
  plugins: [],
}
