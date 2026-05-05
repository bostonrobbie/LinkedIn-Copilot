/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 50: '#f7f7f8', 100: '#eceef0', 200: '#d8dce0', 800: '#1f2328', 900: '#0e1116' },
        accent: { DEFAULT: '#0a66c2', dark: '#004182' }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif']
      }
    }
  },
  plugins: []
};
