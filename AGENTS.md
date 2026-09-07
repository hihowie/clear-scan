1. Follow KISS and YAGNI. Keep solutions simple and avoid unnecessary code or abstractions.
2. Keep code modular and organize it by functionality. Avoid files containing thousands of lines.
3. Keep all tests under `tests/`: `unit/` for unit tests organized by source module, `integration/` for cross-module and page workflow tests, `e2e/` for end-to-end tests, and `support/` for shared fixtures, setup, and test helpers. Do not scatter tests across `src/` or other directories.
4. Group tests for the same functionality by scenario, give each test layer a clear responsibility, reuse shared fixtures and helpers, and avoid duplicate coverage. When moving tests, update test configuration, type-checking scope, and documentation together.
5. When fixing a bug, identify and explain its root cause, fix it in the module responsible for the behavior, and add necessary regression tests covering the actual triggering scenario.
6. Use Chinese only when communicating with the user, including progress updates, reports, root cause explanations, and validation results. Clearly describe what changed, why it changed, and the results of checks actually performed.
7. Use English for code comments and Git commit messages, including both the subject and body.
8. Use ASCII punctuation and symbols instead of Chinese or full-width punctuation and symbols, including in Chinese replies to the user.
