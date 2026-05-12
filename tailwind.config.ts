import type { Config } from 'tailwindcss'

const config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'] as const,
  theme: {
    extend: {
      fontFamily: {
        display: ['Noto Serif', 'Georgia', 'Times New Roman', 'serif'],
        body: ['Noto Sans', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        xs: 'var(--text-xs)',
        sm: 'var(--text-sm)',
        base: 'var(--text-base)',
        md: 'var(--text-md)',
        lg: 'var(--text-lg)',
        xl: 'var(--text-xl)',
        '2xl': 'var(--text-2xl)',
        '3xl': 'var(--text-3xl)',
      },
      colors: {
        bg: 'var(--bg)',
        'bg-sunken': 'var(--bg-sunken)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        text: 'var(--text)',
        muted: 'var(--text-muted)',
        faint: 'var(--text-faint)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-fg': 'var(--accent-fg)',
        'accent-soft': 'var(--accent-soft)',
        success: 'var(--success)',
        'success-bg': 'var(--success-bg)',
        info: 'var(--info)',
        'info-bg': 'var(--info-bg)',
        warning: 'var(--warning)',
        'warning-bg': 'var(--warning-bg)',
        danger: 'var(--danger)',
        'danger-bg': 'var(--danger-bg)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius-lg)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        lg: 'var(--shadow-lg)',
        focus: 'var(--focus-ring)',
      },
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        5: 'var(--space-5)',
        6: 'var(--space-6)',
        7: 'var(--space-7)',
        8: 'var(--space-8)',
      },
      screens: {
        mobile: { max: '720px' },
        tablet: { max: '900px' },
        editor: '1024px',
        wide: '1280px',
      },
      transitionTimingFunction: { out: 'var(--ease-out)' },
      transitionDuration: {
        fast: 'var(--dur-fast)',
        base: 'var(--dur-base)',
        slow: 'var(--dur-slow)',
      },
      keyframes: {
        'overlay-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'overlay-content-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'drawer-in': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'sheet-in': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'menu-in': {
          from: { opacity: '0', transform: 'translateY(-4px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'palette-in': {
          from: { opacity: '0', transform: 'translateY(-8px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        spin: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'skeleton-shimmer': {
          '0%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      },
      animation: {
        'overlay-in': 'overlay-in var(--dur-base) var(--ease-out)',
        'overlay-content-in': 'overlay-content-in var(--dur-base) var(--ease-out)',
        'drawer-in': 'drawer-in var(--dur-slow) var(--ease-out)',
        'sheet-in': 'sheet-in var(--dur-slow) var(--ease-out)',
        'menu-in': 'menu-in var(--dur-fast) var(--ease-out)',
        'toast-in': 'toast-in var(--dur-base) var(--ease-out)',
        'palette-in': 'palette-in var(--dur-base) var(--ease-out)',
        spin: 'spin 1s linear infinite',
        shimmer: 'skeleton-shimmer 1.4s linear infinite',
      },
    },
  },
} satisfies Config

export default config
