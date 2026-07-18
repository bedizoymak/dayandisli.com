import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Testing Library's auto-cleanup only self-registers for Jest; under Vitest it
// must be wired explicitly, otherwise DOM (and Radix's body pointer-events
// lock while a dialog is open) leaks between tests in the same file.
afterEach(() => {
  cleanup();
});
