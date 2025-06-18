module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/test'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(pixi.js|earcut)/)',
  ],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    'earcut': '<rootDir>/test/__mocks__/earcut.js',
  },
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(ts|js)$',
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      useESM: true,
    },
  },
};
