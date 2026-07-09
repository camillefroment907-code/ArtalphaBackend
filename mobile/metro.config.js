// metro.config.js
// Required for Expo Router: tells Metro to use expo-router/entry as the bundle entry point.
// Without this file, Metro cannot resolve ./index and the app fails to load.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
