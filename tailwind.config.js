/**
 * File: tailwind.config.js
 * Description: Defines the NativeWind content scan paths and shared public and nexus theme tokens.
 */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        public: '0 24px 80px rgba(5, 10, 18, 0.32)',
        nexus: '0 18px 60px rgba(3, 8, 13, 0.35)',
      },
      colors: {
        public: {
          canvas: '#07111c',
          shell: '#0a1623',
          panel: '#102235',
          veil: '#16334a',
          line: '#28455d',
          text: '#ecf4fb',
          muted: '#9bb2c5',
          accent: '#9fe870',
          accentSoft: '#d7ffbf',
          cyan: '#6dd3ff',
          sand: '#f7d995',
        },
        nexus: {
          canvas: '#06111a',
          ink: '#08131d',
          panel: '#0f1d2b',
          strong: '#132638',
          overlay: '#173246',
          line: '#23415a',
          text: '#e7eef5',
          muted: '#8fa7ba',
          sky: '#7dd3fc',
          mint: '#6ee7b7',
          gold: '#fbbf24',
          rose: '#fb7185',
        },
      },
      letterSpacing: {
        nexus: '0.24em',
      },
    },
  },
  plugins: [],
};
