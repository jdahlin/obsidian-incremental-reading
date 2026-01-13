import { resolve } from 'node:path'
import type { Config } from 'tailwindcss'

export default {
	darkMode: ['class'],
	content: [
		resolve(__dirname, 'pages/**/*.{ts,tsx}'),
		resolve(__dirname, 'components/**/*.{ts,tsx}'),
		resolve(__dirname, 'app/**/*.{ts,tsx}'),
		resolve(__dirname, 'src/**/*.{ts,tsx}'),
	],
	prefix: '',
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px',
			},
		},
		extend: {
			fontFamily: {
				sans: ['Inter', 'system-ui', 'sans-serif'],
				serif: ['Playfair Display', 'Georgia', 'serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))',
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))',
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))',
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))',
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))',
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))',
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-bg))',
					foreground: 'hsl(var(--sidebar-foreground))',
					muted: 'hsl(var(--sidebar-muted))',
					accent: 'hsl(var(--sidebar-accent))',
					hover: 'hsl(var(--sidebar-hover))',
				},
				content: {
					DEFAULT: 'hsl(var(--content-bg))',
				},
				search: {
					DEFAULT: 'hsl(var(--search-bg))',
					border: 'hsl(var(--search-border))',
					focus: 'hsl(var(--search-focus))',
				},
				highlight: {
					DEFAULT: 'hsl(var(--highlight))',
					soft: 'hsl(var(--highlight-soft))',
				},
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' },
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' },
				},
				'fade-in': {
					from: { opacity: '0', transform: 'translateY(8px)' },
					to: { opacity: '1', transform: 'translateY(0)' },
				},
				'slide-in-right': {
					from: { opacity: '0', transform: 'translateX(16px)' },
					to: { opacity: '1', transform: 'translateX(0)' },
				},
				'pulse-soft': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.7' },
				},
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.3s ease-out',
				'slide-in-right': 'slide-in-right 0.3s ease-out',
				'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
			},
			boxShadow: {
				soft: '0 2px 8px -2px rgba(0, 0, 0, 0.08), 0 4px 16px -4px rgba(0, 0, 0, 0.06)',
				medium: '0 4px 12px -2px rgba(0, 0, 0, 0.1), 0 8px 24px -4px rgba(0, 0, 0, 0.08)',
				glow: '0 0 20px -5px hsl(var(--primary) / 0.3)',
			},
		},
	},
	plugins: [require('tailwindcss-animate')],
} satisfies Config
