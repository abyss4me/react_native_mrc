# Release & Commit Management Skill

When helping with commits or releases, you must follow these rules strictly:

## 1. Commit Message Convention
- Format: `<type>(<scope>): <description>`
- Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `ci`.
- Scopes: `gameplay`, `level`, `ui`, `input`, `audio`, `render`, `engine`, `assets`, `ads`, `iap`, `leaderboard`, `analytics`, `build`.
- Style: Lowercase, kebab-case, imperative verbs (e.g., "add", "fix"). 
- Restriction: No period at the end. No spaces in scope.

## 2. Release Process (Step-by-Step)
If I ask to "prepare a release":

### Step A: Update config.json
- Increment the "version" field inside the "project" object in `config.json`.
- Use Semantic Versioning: MAJOR (breaking), MINOR (feat), PATCH (fix).

### Step B: Update README.md
- Find the "Build history:" section.
- Add a new entry at the top: `[vX.Y.Z] - YYYY-MM-DD: <Short Summary>`.
- List changes based on the latest commits as bullet points.
- **CRITICAL**: Do NOT modify or touch the "## Build Description" block. It is managed by an external generator.

### Step C: Git Tag
- Generate the command: `git tag v<X.Y.Z>`
- The tag must match the new version in `config.json`.

## 3. Breaking Changes
- Add `!` after the scope if changes break the API or existing functionality (e.g., `feat(ui)!: redesign navigation`).

## 4. Pre-Push Gate — Unit Tests
Before running `git push`, you MUST run the full test suite:
```
npx jest --no-coverage
```
- **All tests must pass (0 failures)** before pushing.
- If any test fails: stop, fix the issue, re-run tests, then push.
- This rule applies to commits of types: `feat`, `fix`, `refactor`, `perf`.
- Exempt types (no test run required): `docs`, `chore`, `ci`, `assets`.
