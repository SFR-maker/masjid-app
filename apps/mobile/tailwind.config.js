/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1B4332',
          50: '#D8F3DC',
          100: '#B7E4C7',
          200: '#74C69D',
          300: '#52B788',
          400: '#40916C',
          500: '#2D6A4F',
          600: '#1B4332',
          700: '#163728',
          800: '#112B1E',
          900: '#0C1F14',
        },
        gold: '#D4A017',
        surface: '#FFFFFF',
        background: '#F8FAF9',
        muted: '#6B7280',
      },
    },
  },
  plugins: [],
}
