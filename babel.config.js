module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 54) auto-includes the react-native-worklets
    // plugin that Reanimated 4 requires, so it doesn't need to be listed here.
    presets: ['babel-preset-expo'],
  };
};
