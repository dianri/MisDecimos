/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Apple "Titanio, Oro Cava y Verde Granito" tokens
        platinum: '#F5F5F7',
        carbon: '#1D1D1F',
        cava: {
          DEFAULT: '#C5A880',
          hover: '#B8996E',
        },
        granite: {
          DEFAULT: '#3A5245',
          hover: '#2F4338',
        },
        coral: '#D04848',
        // Legacy aliases mapped to the new design tokens for backwards compatibility
        lottery: {
          50: '#EEF2EF',
          100: '#DCE4DF',
          200: '#BCCAC2',
          300: '#92A89C',
          400: '#5F7D6D',
          500: '#3A5245',
          600: '#2F4338',
          700: '#26372E',
          800: '#1D2B24',
          900: '#16211B',
          DEFAULT: '#3A5245',
        },
        cream: {
          50: '#FFFFFF',
          100: '#F5F5F7',
          DEFAULT: '#F5F5F7',
          200: '#EBEBEF',
          300: '#DFDFE5',
        },
        gold: {
          50: '#FAF6F0',
          100: '#F3EBD9',
          400: '#D4BC9A',
          500: '#C5A880',
          600: '#C5A880',
          700: '#A68A62',
          DEFAULT: '#C5A880',
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"Inter"',
          'sans-serif',
        ],
      },
      borderRadius: {
        'apple': '22px',
      }
    },
  },
  plugins: [],
}
