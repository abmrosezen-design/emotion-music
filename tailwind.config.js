/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        body: ['Barlow', 'sans-serif'],
        hero: ['Inter', 'sans-serif'],
        serif: ['Instrument Serif', 'serif'],
        dirty: ['Dirtyline', 'cursive'],
      },
    },
  },
  plugins: [],
}
