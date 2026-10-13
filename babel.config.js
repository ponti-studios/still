module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Zod uses `export * as ns from`, which the React Native preset does not transform on its own.
  plugins: ['@babel/plugin-transform-export-namespace-from'],
};
