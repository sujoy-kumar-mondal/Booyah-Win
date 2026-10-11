/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gaming: {
          bg: '#090D16',
          card: '#111827',
          cardBorder: '#1F2937',
          primary: '#10B981',
          primaryHover: '#059669',
          accent: '#F59E0B',
          danger: '#EF4444',
        },
      },
    },
  },
  plugins: [],
};
