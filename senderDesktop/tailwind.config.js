/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js}'],
  theme: {
    extend: {
      colors: {
        dark: {
          primary: '#1a1a1a',
          secondary: '#2d2d2d',
          accent: '#444',
          text: '#ffffff',
          'text-secondary': '#ccc',
          'text-muted': '#666',
        },
        status: {
          connected: '#4caf50',
          connecting: '#ff9800',
          streaming: '#2196f3',
          reconnecting: '#ff5722',
          error: '#f44336',
          disconnected: '#666',
        },
      },
      animation: {
        'pulse-slow': 'pulse 1s infinite',
        'pulse-fast': 'pulse 0.5s infinite',
      },
    },
  },
  plugins: [],
};
