/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // CubeOS brand colors (from brand guidelines)
        cube: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',  // Teal Light
          500: '#14b8a6',  // Teal Primary
          600: '#0d9488',  // Teal Dark  
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        // Navy colors for backgrounds
        navy: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',  // Slate Light
          500: '#64748b',  // Slate Mid
          600: '#475569',  // Slate Dark
          700: '#3a5570',  // Navy Light
          800: '#2a4258',  // Navy Mid
          900: '#1a2e3f',  // Navy Dark
          950: '#0f172a',  // Background
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
