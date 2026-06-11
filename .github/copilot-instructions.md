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

### Step B: Update RELEASES.md
- Open `RELEASES.md` in the project root.
- Add a new entry **at the top** (below the header block), following this format:
  ```
  ## [vX.Y.Z] - YYYY-MM-DD: <Short Summary>

  ### Added / Changed / Fixed / Removed
  - bullet points based on the latest commits
  ```
- Use Conventional Commit types to group bullets: `feat` → Added, `fix` → Fixed, `refactor`/`perf` → Changed, breaking → Removed/Breaking.
- **Do NOT modify `README.md`** for build history. The `## Build Description` block in README is managed by an external generator and must never be touched.

### Step C: Git Tag
- Generate the command: `git tag v<X.Y.Z>`
- The tag must match the new version in `config.json`.

## 3. Breaking Changes
- Add `!` after the scope if changes break the API or existing functionality (e.g., `feat(ui)!: redesign navigation`).

## 4. File Naming Conventions
When creating new files, follow these rules:

| Category | Convention | Examples |
|----------|------------|---------|
| React components (`.tsx`) | **PascalCase** | `Button.tsx`, `HomeScreen.tsx`, `ScreenRenderer.tsx` |
| React hooks (`.ts`) | **camelCase** + `use` prefix | `useAppLifecycle.ts`, `useUIScale.ts` |
| Classes / Services (`.ts`) | **PascalCase** | `ClientManager.ts`, `FeedbackService.ts`, `AssetsLoader.ts` |
| Utility modules / multi-export (`.ts`) | **PascalCase** | `LayoutUtils.ts`, `ComponentStateResolver.ts`, `LayoutContext.ts` |
| Type definition files (`.ts`) | **PascalCase** | `LayoutTypes.ts`, `ProtocolTypes.ts` |
| Single-function utility files (`.ts`) | **camelCase** | `applyServerData.ts`, `throttledSend.ts`, `resolveBackground.ts` |
| Constants files | **camelCase** | `constants.ts` |
| Barrel / index files | **lowercase** | `index.tsx` |

**Key rule:**
- Use **PascalCase** if the file is a React component, a class, a service, or a module with multiple public exports.
- Use **camelCase** if the file exports a single function, a hook, or pure constants.

## 5. Pre-Push Gate — Unit Tests
Before running `git push`, you MUST run the full test suite:
```
npx jest --no-coverage
```
- **All tests must pass (0 failures)** before pushing.
- If any test fails: stop, fix the issue, re-run tests, then push.
- This rule applies to commits of types: `feat`, `fix`, `refactor`, `perf`.
- Exempt types (no test run required): `docs`, `chore`, `ci`, `assets`.
