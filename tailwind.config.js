/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lottery: {
          50: '#f0f7f3',
          100: '#dceee3',
          200: '#bcdecb',
          300: '#92c7ad',
          400: '#5fa788',
          500: '#2E6146',
          600: '#255039',
          700: '#1e402e',
          800: '#1a3427',
          900: '#162c21',
          DEFAULT: '#2E6146',
        },
        cream: {
          50: '#ffffff',
          100: '#fafbfa',
          DEFAULT: '#F7F9F7',
          200: '#eff2ef',
          300: '#e3e8e3',
        },
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#D97706',
          700: '#b45309',
          DEFAULT: '#D97706',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
