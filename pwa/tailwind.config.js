/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          900: '#F3EBDD',
          800: '#E8DCCB',
          700: '#D5C3A9',
          600: '#9C8F83',
          500: '#8C4A3B',
          400: '#6B5E52',
          300: '#4A3B2F',
          200: '#3D2A1C',
          100: '#352518',
          50: '#2E1F14',
        },
        teal: {
          400: '#2F5D50',
          300: '#3A6E5F',
          500: '#1F4238',
        },
        red: {
          500: '#8C4A3B',
          400: '#A65D4D',
        },
        palette: {
          gold: '#B8A36A',
          ink: '#2E1F14',
          parchment: '#F3EBDD'
        }
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'wave': 'wave-expand 2s infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: 1, filter: 'drop-shadow(0 0 10px rgba(47, 93, 80, 0.3))' },
          '50%': { opacity: .9, filter: 'drop-shadow(0 0 20px rgba(47, 93, 80, 0.5))' },
        },
        'wave-expand': {
          '0%': { transform: 'scale(0.8)', opacity: '0.6' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        }
      }
    }
  },
  plugins: [],
}
