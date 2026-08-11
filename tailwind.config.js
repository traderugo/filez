/** @type {import('tailwindcss').Config} */
module.exports = {
  // Class-based, driven by the pre-paint script in app/layout.js and the theme toggle.
  // Nothing is dark until <html> carries the class, so this on its own changes nothing.
  darkMode: 'class',
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
      // Flat-card outline width (design system): definition comes from borders, not shadows.
      borderWidth: {
        card: '2px',
      },
      colors: {
        // Semantic neutral tokens (light/dark via CSS vars in app/globals.css). Screens use
        // bg-surface / text-content / border-line instead of raw white and grays, so dark
        // mode is a variable swap rather than a per-class rewrite.
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        subtle: 'rgb(var(--subtle) / <alpha-value>)',
        line: {
          DEFAULT: 'rgb(var(--line) / <alpha-value>)',
          strong: 'rgb(var(--line-strong) / <alpha-value>)',
        },
        content: {
          DEFAULT: 'rgb(var(--content) / <alpha-value>)',
          strong: 'rgb(var(--content-strong) / <alpha-value>)',
          muted: 'rgb(var(--content-muted) / <alpha-value>)',
          faint: 'rgb(var(--content-faint) / <alpha-value>)',
        },
        // Premeval brand blue — the single accent. station-portal was already blue
        // (bg-blue-600 / bg-blue-700 throughout); this gives that blue a name and a scale
        // so it can be changed in one place and can shift for dark mode.
        primary: {
          DEFAULT: 'rgb(var(--primary-500) / <alpha-value>)',
          50: 'rgb(var(--primary-50) / <alpha-value>)',
          100: 'rgb(var(--primary-100) / <alpha-value>)',
          200: 'rgb(var(--primary-200) / <alpha-value>)',
          300: 'rgb(var(--primary-300) / <alpha-value>)',
          400: 'rgb(var(--primary-400) / <alpha-value>)',
          500: 'rgb(var(--primary-500) / <alpha-value>)',
          600: 'rgb(var(--primary-600) / <alpha-value>)',
          700: 'rgb(var(--primary-700) / <alpha-value>)',
          800: 'rgb(var(--primary-800) / <alpha-value>)',
          900: 'rgb(var(--primary-900) / <alpha-value>)',
          950: 'rgb(var(--primary-950) / <alpha-value>)',
        },
        // The original station orange, unchanged in value — the same channels the literal
        // hex scale carried before, so every existing bg-accent-* renders identically. Now
        // a secondary accent rather than the brand.
        accent: {
          DEFAULT: 'rgb(var(--accent-500) / <alpha-value>)',
          50: 'rgb(var(--accent-50) / <alpha-value>)',
          100: 'rgb(var(--accent-100) / <alpha-value>)',
          200: 'rgb(var(--accent-200) / <alpha-value>)',
          300: 'rgb(var(--accent-300) / <alpha-value>)',
          400: 'rgb(var(--accent-400) / <alpha-value>)',
          500: 'rgb(var(--accent-500) / <alpha-value>)',
          600: 'rgb(var(--accent-600) / <alpha-value>)',
          700: 'rgb(var(--accent-700) / <alpha-value>)',
          800: 'rgb(var(--accent-800) / <alpha-value>)',
          900: 'rgb(var(--accent-900) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
};
