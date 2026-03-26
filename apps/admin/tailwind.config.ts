import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        jakarta: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        fraunces: ['Fraunces', 'Georgia', 'serif'],
      },
      colors: {
        forest: {
          50:  '#F0F7F2',
          100: '#D8F0DF',
          200: '#A8D9B8',
          300: '#6EBD87',
          400: '#3D9E5F',
          500: '#1B7A3E',
          600: '#155F31',
          700: '#0F4423',
          800: '#0A2E17',
          900: '#061A0D',
          950: '#030D07',
        },
        cream: {
          50:  '#FEFDFB',
          100: '#FAF8F3',
          200: '#F4F0E6',
          300: '#EDE6D5',
          400: '#DDD3BC',
        },
        gold: {
          DEFAULT: '#C9963A',
          light:   '#F5E6C8',
          dark:    '#A07820',
        },
      },
      boxShadow: {
        'warm-sm': '0 1px 3px 0 rgba(15,44,23,0.08), 0 1px 2px -1px rgba(15,44,23,0.06)',
        'warm-md': '0 4px 16px 0 rgba(15,44,23,0.10), 0 2px 4px -2px rgba(15,44,23,0.06)',
        'warm-lg': '0 12px 32px 0 rgba(15,44,23,0.12), 0 4px 8px -4px rgba(15,44,23,0.08)',
        'gold':    '0 0 0 1px rgba(201,150,58,0.3), 0 4px 16px rgba(201,150,58,0.15)',
      },
      backgroundImage: {
        'forest-gradient': 'linear-gradient(160deg, #0F4423 0%, #0A2E17 60%, #061A0D 100%)',
        'gold-gradient':   'linear-gradient(135deg, #C9963A 0%, #A07820 100%)',
        'warm-gradient':   'linear-gradient(160deg, #FEFDFB 0%, #FAF8F3 100%)',
        'card-hover':      'linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(250,248,243,1) 100%)',
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-out',
        'slide-down': 'slideDown 0.25s ease-out',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { from: { opacity: '0', transform: 'translateY(-8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pulseGold: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
      },
    },
  },
  plugins: [],
}

export default config
