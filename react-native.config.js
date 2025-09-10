module.exports = {
  project: {
    ios: {},
    android: {},
  },
  assets: ['./src/assets/fonts/', './src/assets/images/'],
  dependencies: {
    'react-native-vector-icons': {
      platforms: {
        android: null, // disable autolinking completely
        ios: null,
      },
    },
  },
};