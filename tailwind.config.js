/**
 * File: tailwind.config.js
 * Description: Defines the NativeWind content scan paths and portal theme tokens.
 */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        portal: '0 18px 60px rgba(3, 8, 13, 0.35)',
      },
      colors: {
        portal: {
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
        portal: '0.24em',
      },
    },
  },
  plugins: [],
};
