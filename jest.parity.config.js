// Jest configuration for the semantic parity gate suite (issue #1225).
// Runs the full UED-to-renderer parity suite. npm run test:parity

const nextJest = require('next/jest').default;
const createJestConfig = nextJest({ dir: './' });

const parityConfig = {
    testEnvironment: 'node',
    testMatch: [
          '**/__tests__/lib/evaluation/evaluationReportViewModel.test.ts',
          '**/__tests__/lib/evaluation/viewModelBoundaryGate.test.ts',
          '**/__tests__/lib/evaluation/surfaceParityGate.test.ts',
          '**/__tests__/lib/evaluation/surfaceParityVerification.test.ts',
          '**/__tests__/lib/evaluation/renderingParityTests.test.ts',
          '**/__tests__/lib/evaluation/downloadParityGate.test.ts',
          '**/__tests__/lib/evaluation/downloadViewModelBoundaryGate.test.ts',
          '**/__tests__/lib/evaluation/strictUedAuthorSurfaces.test.ts',
          '**/__tests__/app/reports/*.guard.test.ts',
        ],
    moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
    setupFiles: ['<rootDir>/jest.setup.ts'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.worktrees/'],
    forceExit: true,
  };

module.exports = createJestConfig(parityConfig);
