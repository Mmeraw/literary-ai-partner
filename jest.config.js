const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  testEnvironment: "node",
  testMatch: ["**/?(*.)+(test).[tj]s?(x)"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
};

module.exports = createJestConfig(customJestConfig);
