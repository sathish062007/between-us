/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cinema: {
          950: '#07090E',
          900: '#0B0F19',
          850: '#111726',
          800: '#171F32',
          700: '#222D46',
          600: '#334164',
          accent: '#6366F1',
          glow: '#818CF8',
          hot: '#EC4899',
          emerald: '#10B981',
          amber: '#F59E0B',
          rose: '#F43F5E',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'float-up': 'floatUp 2s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        floatUp: {
          '0%': { opacity: '1', transform: 'translateY(0) scale(0.8)' },
          '50%': { opacity: '1', transform: 'translateY(-60px) scale(1.3)' },
          '100%': { opacity: '0', transform: 'translateY(-120px) scale(1)' },
        }
      }
    },
  },
  plugins: [],
}
