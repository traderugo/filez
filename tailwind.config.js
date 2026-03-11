/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        accent: {
          DEFAULT: '#F4611E',
          50: '#FEF3EC',
          100: '#FDE0CF',
          200: '#FBBF9A',
          300: '#F89D65',
          400: '#F67C30',
          500: '#F4611E',
          600: '#D44D12',
          700: '#A33B0E',
          800: '#732A0A',
          900: '#421806',
        },
      },
    },
  },
  plugins: [],
};
