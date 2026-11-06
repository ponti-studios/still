module.exports = {
  preset: '@react-native/jest-preset',
  testPathIgnorePatterns: ['/node_modules/', '/StillCore/', '/ios/'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native(?:-.+)?|react-native-reanimated|react-native-worklets)/)',
  ],
  setupFiles: ['<rootDir>/jest.setup.js'],
  resolver: 'react-native-reanimated/jest/resolver',
};
