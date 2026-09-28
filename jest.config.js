module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  transform: {
    '^.+\\.js$': ['babel-jest', {
      babelrc: false,
      configFile: false,
      presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
    }],
  },
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
