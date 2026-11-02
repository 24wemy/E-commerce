import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: ['"Plus Jakarta Sans Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  		},
  		colors: {
  			// Fresh Minut: hijau daun (utama), kunyit (aksen promo), cabai (diskon/peringatan)
  			daun: { 50: '#EEF6F0', 100: '#D6EADB', 200: '#AED5B8', 300: '#7FBA8F', 400: '#4F9A65', 500: '#2F7F48', 600: '#1F6B3A', 700: '#185731', 800: '#134528', 900: '#0F3620', 950: '#082114' },
  			kunyit: { 50: '#FEF9E6', 100: '#FDF0BF', 200: '#FBE07F', 300: '#F8CD3E', 400: '#F2B705', 500: '#D9A204', 600: '#B08303', 700: '#866402', 800: '#5C4502', 900: '#3A2C01', 950: '#221A00' },
  			cabai: { 50: '#FBECE9', 100: '#F6D2CC', 400: '#DD5A45', 500: '#C8321E', 600: '#A82815', 700: '#861F10' },
  			ink: '#1C2421',
  			surface: '#F6F7F4',
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
