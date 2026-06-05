// Minimal react-native mock for unit tests (no UI, no native modules needed)
const Dimensions = {
    get: () => ({ width: 1280, height: 720 }),
};

module.exports = {
    Dimensions,
    StyleSheet: { create: (s) => s },
};

