import type { Config } from 'tailwindcss';

/**
 * EgMax design tokens.
 *
 * Premium, dark, editorial. Custom identity — not a Spotify clone.
 *
 *   Surface        Hex          Usage
 *   ─────────      ─────        ─────────────────────────────────
 *   ink-900        #0B0B0E      App body (warm-tinted near-black)
 *   ink-800        #131317      Sidebars, sticky bars, modals
 *   ink-700        #1A1A20      Card surfaces
 *   ink-600        #25252D      Hover states
 *   ink-500        #383842      Borders / dividers
 *   ink-400        #53535F      Disabled / placeholders
 *
 *   text-50        #F5F1EA      Headlines (warm off-white)
 *   text-100       #E7E2D8      Body
 *   text-300       #A09CA0      Subdued
 *   text-500       #6B6770      Quiet metadata
 *
 *   coral-500      #FF5E3A      Primary accent (electric coral)
 *   coral-400      #FF7A5C      Hover
 *   coral-600      #E84A2A      Pressed
 *   ember-500      #FFB347      Secondary highlight (warm amber)
 *   ink-purple     #2C1A48      Editorial gradient anchor
 *
 *   success        #4ADE80      Used sparingly
 *   warn           #FBBF24
 *   danger         #F87171
 */

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0B0B0E',
          800: '#131317',
          700: '#1A1A20',
          600: '#25252D',
          500: '#383842',
          400: '#53535F',
        },
        cream: {
          50:  '#F5F1EA',
          100: '#E7E2D8',
          300: '#A09CA0',
          500: '#6B6770',
        },
        coral: {
          400: '#FF7A5C',
          500: '#FF5E3A',
          600: '#E84A2A',
        },
        ember: {
          500: '#FFB347',
        },
        purple: {
          ink: '#2C1A48',
        },
        // Backward-compat aliases so existing components keep compiling.
        spotify: {
          green: '#FF5E3A',
          'green-hover': '#FF7A5C',
          'green-glow': '#FF5E3A55',
          black: '#0B0B0E',
          'true-black': '#000000',
          'dark-gray': '#131317',
          'darker-gray': '#0B0B0E',
          'light-gray': '#1A1A20',
          'lighter-gray': '#25252D',
          'text-gray': '#A09CA0',
          'text-light': '#E7E2D8',
        },
        accent: {
          purple: '#2C1A48',
          pink:   '#FF5E3A',
          orange: '#FFB347',
          blue:   '#4F8AE8',
        },
      },
      fontFamily: {
        // Geometric sans — body & UI
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Editorial serif — display & masthead (the brand signature)
        serif: ['var(--font-serif)', 'ui-serif', 'Georgia', 'serif'],
        display: ['var(--font-serif)', 'ui-serif', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        arabic: ['var(--font-arabic)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Editorial type scale
        'eyebrow': ['11px', { lineHeight: '1.2', letterSpacing: '0.12em' }],
        'display-sm':  ['2.25rem', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'display':     ['3.5rem',  { lineHeight: '1.0',  letterSpacing: '-0.025em' }],
        'display-lg':  ['5rem',    { lineHeight: '0.95', letterSpacing: '-0.03em' }],
        'display-xl':  ['7rem',    { lineHeight: '0.92', letterSpacing: '-0.035em' }],
      },
      animation: {
        'fade-in':       'fadeIn 0.5s ease-out',
        'fade-in-up':    'fadeInUp 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-in-right':'slideInRight 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in':      'scaleIn 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
        'pulse-soft':    'pulseSoft 3s ease-in-out infinite',
        'now-playing':   'nowPlaying 1.4s ease-in-out infinite',
        'shimmer':       'shimmer 2.5s infinite linear',
        'grain':         'grain 8s steps(8) infinite',
        // legacy aliases
        'spin-slow':      'spin 12s linear infinite',
        'pulse-glow':     'pulseSoft 3s ease-in-out infinite',
        'gradient-shift': 'gradientShift 12s ease-in-out infinite',
        'wave-1':         'nowPlaying 1.4s ease-in-out infinite',
        'wave-2':         'nowPlaying 1.4s ease-in-out infinite 0.15s',
        'wave-3':         'nowPlaying 1.4s ease-in-out infinite 0.3s',
        'wave-4':         'nowPlaying 1.4s ease-in-out infinite 0.45s',
        'float':          'float 8s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        fadeInUp:  {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%':   { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.6' },
          '50%':      { opacity: '1' },
        },
        nowPlaying: {
          '0%, 100%': { transform: 'scaleY(0.35)' },
          '50%':      { transform: 'scaleY(1)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        grain: {
          '0%':   { transform: 'translate(0, 0)' },
          '12%':  { transform: 'translate(-1%, 1%)' },
          '25%':  { transform: 'translate(-2%, -1%)' },
          '37%':  { transform: 'translate(2%, 1%)' },
          '50%':  { transform: 'translate(-1%, 2%)' },
          '62%':  { transform: 'translate(1%, -2%)' },
          '75%':  { transform: 'translate(-2%, -1%)' },
          '87%':  { transform: 'translate(2%, 2%)' },
          '100%': { transform: 'translate(0, 0)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':      { backgroundPosition: '100% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
