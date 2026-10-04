/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#fbf8eb',
          100: '#f5eecc',
          200: '#ebd999',
          300: '#dec066',
          400: '#d4af37',
          500: '#c59b27',
          600: '#a87b1e',
          700: '#865b1b',
          800: '#704a1c',
          900: '#5f3e1d',
          950: '#37200d',
        },
      },
      fontFamily: {
        sans: ['Cairo', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
