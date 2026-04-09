/**
 * File: babel.config.js
 * Description: Enables Expo transforms and NativeWind class extraction.
 */
module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo', 'nativewind/babel'],
    plugins: [],
  };
};
