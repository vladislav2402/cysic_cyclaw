import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}', './src/lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#000000',
        panel: '#0d0d0f',
        snow: '#fffafa',
        cyan: '#22d3ee',
        lime: '#22d3ee',
        violet: '#7c3aed',
        neutral: {
          400: '#a8a29e',
          600: '#525252',
        },
      },
      fontFamily: {
        sans: ['var(--font-montserrat)', 'Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        heading: ['"Gemsbuck 01"', 'var(--font-montserrat)', 'Montserrat', 'ui-sans-serif', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 32px rgba(34, 211, 238, 0.22)',
        lift: '0 22px 70px rgba(0, 0, 0, 0.35)',
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(34,211,238,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.06) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
}

export default config
