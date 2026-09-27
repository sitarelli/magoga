import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        crema: '#fbf4e6',
        sabbia: '#f1e2c6',
        legno: { 400: '#a26a3a', 600: '#7a4a24', 800: '#4a2d17', 900: '#2e1c0f' },
        spritz: { 300: '#ffb070', 400: '#ff8a3d', 500: '#f26b1d', 600: '#d4550f' },
        prosecco: '#e9c46a',
        laguna: '#2f7f86',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Manrope', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
