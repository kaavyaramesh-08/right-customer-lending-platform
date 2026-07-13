/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#556B2F',
        'primary-dark': '#3F5220',
        accent: '#A9A067',
        bgLight: '#F5F5EE',
        cream: '#F5F5EE',
        surface: '#FFFFFF',
        surfaceBorder: '#D9D9C2',
        success: '#6B8E23',
        warning: '#C08A2E',
        danger: '#8B4A3B',
        textPrimary: '#2E2E1F',
        textSecondary: '#6B6B54',
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
