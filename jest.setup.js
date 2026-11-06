// The animation engine needs a native runtime that tests do not have.
// Screens render through the mock; transitions simply apply instantly.
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
