# Project Guidelines

## Engineering

1. Follow KISS and YAGNI in code and project instructions. Add features, options, or abstractions only for a concrete use in the current task; hypothetical future use and tests written solely for a new feature do not justify it. When referencing upstream, implement only the needed subset and preserve its semantics without adding policies the task does not require. When removing a feature, also remove its unused implementation, exports, configuration, documentation, and tests. Keep instructions actionable, without duplicating existing rules or narrating past incidents.
2. Keep code modular and organize it by functionality. Avoid files containing thousands of lines.
3. Write idiomatic, readable code suitable for human review in an open source project. Follow established language and repository conventions, use clear names and straightforward control flow, and avoid opaque or unnecessarily clever code.
4. Backward compatibility is not required anywhere in the project. Target the current design directly; do not add compatibility shims, legacy configuration support, or migration instructions for old versions and deployments.
5. When fixing a bug, trace the failure to the underlying flaw in the logic, data flow, or design, explain it, and fix it in the module responsible for the behavior. Aim to remove the cause, not merely suppress errors or add special cases that hide the symptoms. Check related paths affected by the same cause and verify the original triggering scenario. If a workaround is unavoidable, explicitly explain why the root cause cannot yet be fixed and what remains unresolved.
6. Separate adjacent Rust functions and methods with one blank line. Place the blank line before any documentation comments or attributes attached to the next function.
7. Use modern package managers appropriate to the project's language ecosystem, such as `pnpm` for JavaScript/TypeScript, `cargo` for Rust, and `uv` for Python. If a required package manager is not installed on the system, prompt the user to install it.

## Testing

1. Keep testing proportional to the change. For bug fixes, add the smallest regression test that reproduces the actual failure when existing tests do not already cover it. Add other cases only for meaningful behavior, nontrivial boundaries, and concrete, likely failure modes supported by the code or usage. Do not add redundant tests, speculative edge cases, exhaustive combinations, or tests that merely check simple assignments, pass-through calls, fixed constants, or standard library behavior.
2. Keep standalone test files and test-only helpers under each package's top-level `tests/` directory, including `frontend/tests/`, except for the language-specific inline tests described here. Treat Go `*_test.go` files as inline tests for placement: keep them alongside the corresponding package's implementation, with test-only helpers also in `*_test.go` files; no separate `tests/` directory is required. Rust unit tests that need private implementation access belong in an inline `#[cfg(test)] mod tests` block in the corresponding implementation file; keep helpers that need the same access inside that block. Do not create other standalone test files or test-only directories under `src/`, or widen production visibility solely for tests.
3. Group tests for the same functionality by scenario, give each test layer a clear responsibility, reuse shared fixtures and helpers, and avoid duplicate coverage. When moving tests, update test configuration, type-checking scope, and documentation together.

## Communication

1. Use Chinese only when communicating with the user, including progress updates, reports, root cause explanations, and validation results. Clearly describe what changed, why it changed, and the results of checks actually performed.
2. When explaining a bug or writing a review finding, use plain language and a concrete scenario to explain how it is triggered, what should happen, what actually happens, its impact, and the general direction of the fix. Explain necessary technical terms instead of relying on jargon.
3. Use English for code comments and Git commit messages, including both the subject and body. Format Git commit subjects as `type: summary` or `type(scope): summary` using Conventional Commits, and choose the type to match the change, such as `feat`, `fix`, `refactor`, or `docs`.
4. Use ASCII punctuation and symbols instead of Chinese or full-width punctuation and symbols, including in Chinese replies to the user.

## Frontend

Prefer the UI framework's existing components, props, theme tokens, and utility classes. In the frontend, use components from the project's existing frontend framework or UI library for equivalent UI behavior and appearance instead of recreating them with custom markup or CSS. Write custom CSS only for requirements the framework or library cannot reasonably cover, and keep it minimal.

## Project-Specific Guidelines

<!-- Add project-specific requirements here, including their scope and any behavior that must be preserved. -->
