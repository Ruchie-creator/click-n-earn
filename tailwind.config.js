/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#172033',
        navy: '#1F3558',
        indigo: '#2C2C55',
        'navy-hover': '#182A46',
        accent: '#4F6FAE',
        'soft-blue': '#EEF3FA',
        canvas: '#F8FAFC',
        muted: '#667085',
        subtle: '#98A2B3',
        line: '#D9E2EC',
        success: '#16A34A',
        warning: '#D97706',
        processing: '#2563EB',
        error: '#DC2626',
        info: '#0EA5E9',
      },
      boxShadow: {
        soft: '0 18px 50px rgba(16, 32, 39, 0.07)',
        card: '0 1px 3px rgba(16, 32, 39, 0.03), 0 8px 24px rgba(16, 32, 39, 0.04)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
