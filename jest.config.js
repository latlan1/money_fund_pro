module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverageFrom: [
    "src/data-utils.js",
    // Add more files as tests are added
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 95,
      lines: 90,
      statements: 90,
    },
  },
  verbose: true,
};
