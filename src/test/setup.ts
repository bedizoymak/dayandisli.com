import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// vitest.config.ts does not set test.globals, so @testing-library/react's
// automatic afterEach(cleanup) registration (which relies on detecting a
// global test framework) never fires. Without this, every render() across
// every test file in the repo accumulates in the same jsdom document instead
// of unmounting between tests.
afterEach(() => {
  cleanup();
});
