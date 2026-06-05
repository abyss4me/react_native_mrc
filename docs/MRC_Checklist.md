# MRC Architecture / Code Review Checklist

## Core Architecture

- [ ] Check render/update flow consistency
- [ ] Verify component lifecycle behavior
- [ ] Verify screen switching logic
- [ ] Check reconnection flow
- [ ] Verify GAME_STATE restore behavior
- [ ] Check message dispatch consistency
- [ ] Validate protocol semantics (`LOAD_SCREEN`, `PATCH_STATE`, etc.)
- [ ] Ensure no duplicated state sources
- [ ] Verify layout immutability assumptions
- [ ] Ensure all state mutations are immutable

---

# Performance

- [ ] Check unnecessary re-renders
- [ ] Add `React.memo` where beneficial
- [ ] Verify stable callbacks with `useCallback`
- [ ] Verify stable memoized values with `useMemo`
- [ ] Check for unnecessary deep cloning
- [ ] Avoid recalculating static layout maps
- [ ] Verify update path complexity
- [ ] Check asset resolving performance
- [ ] Verify image loading / caching behavior
- [ ] Test performance on weak Android devices
- [ ] Test scaling performance on tablets
- [ ] Check resize/orientation handling
- [ ] Check memory leaks on reconnect/disconnect

---

# Code Quality

- [ ] Check code for `any`
- [ ] Replace `any` with proper TypeScript types where possible
- [ ] Check and remove unused imports
- [ ] Check and remove unused includes
- [ ] Check and remove unused states
- [ ] Check and remove unused refs
- [ ] Check and remove unused callbacks
- [ ] Check and remove dead code
- [ ] Check for duplicated logic
- [ ] Move reusable logic into helpers/utils
- [ ] Reduce component complexity
- [ ] Ensure naming consistency
- [ ] Ensure consistent file structure
- [ ] Verify no stale closures
- [ ] Check for side effects inside render

---

# Comments / Documentation

- [ ] Clear and check comments relevance
- [ ] Remove outdated comments
- [ ] Remove misleading comments
- [ ] Ensure comments explain WHY, not WHAT
- [ ] Document protocol behavior
- [ ] Document merge/update order
- [ ] Document scaling behavior
- [ ] Document asset resolution behavior

---

# React / RN Specific

- [ ] Verify hooks dependency arrays
- [ ] Check for unnecessary effects
- [ ] Avoid inline object creation in render
- [ ] Avoid inline functions in render where critical
- [ ] Verify cleanup in effects
- [ ] Verify refs usage
- [ ] Check context separation
- [ ] Check provider render frequency
- [ ] Ensure no infinite render loops

---

# Server-Driven UI

- [ ] Validate component ids uniqueness
- [ ] Verify template merge behavior
- [ ] Verify patch application order
- [ ] Verify style inheritance behavior
- [ ] Verify asset URL resolution
- [ ] Verify partial updates behavior
- [ ] Verify hidden/visible state consistency
- [ ] Verify layout override behavior
- [ ] Check invalid server payload handling
- [ ] Check missing component behavior
- [ ] Check unknown component type behavior

---

# Error Handling

- [ ] Validate malformed messages
- [ ] Validate missing fields
- [ ] Validate invalid component ids
- [ ] Validate invalid URLs
- [ ] Verify reconnect edge cases
- [ ] Verify timeout handling
- [ ] Verify disconnect handling
- [ ] Verify overlay state consistency

---

# Scaling / Responsive

- [ ] Verify dynamic scaling
- [ ] Verify tablet windowed mode
- [ ] Verify Samsung DeX behavior
- [ ] Verify orientation changes
- [ ] Verify aspect-ratio handling
- [ ] Verify safe-area handling
- [ ] Verify ultra-wide devices
- [ ] Verify foldable devices behavior
- [ ] Verify resize events propagation

---

# Testing

- [ ] Add unit tests for merge logic
- [ ] Add tests for patch application
- [ ] Add tests for style resolution
- [ ] Add tests for asset resolution
- [ ] Add tests for reconnect flow
- [ ] Add tests for protocol handlers
- [ ] Add tests for scaling calculations
- [ ] Add regression tests for previous bugs

---

# Future Improvements

- [ ] Consider `useComponentData(id)` only if scaling issues appear
- [ ] Consider selector-based subscriptions later
- [ ] Consider virtualization only if component count grows significantly
- [ ] Consider asset prefetching
- [ ] Consider runtime schema validation
- [ ] Consider stricter protocol typings
- [ ] Consider moving protocol merge logic into isolated engine layer

---

# Release Checklist

- [ ] Test on Android low-end devices
- [ ] Test on tablets
- [ ] Test in split-screen/windowed mode
- [ ] Test reconnect after app backgrounding
- [ ] Test rapid server updates
- [ ] Test asset loading failures
- [ ] Test offline/reconnect scenarios
- [ ] Test memory usage during long sessions
- [ ] Test FPS during frequent updates
- [ ] Verify production logging cleanup
- [ ] Verify no debug logs remain
- [ ] Verify no temporary hacks remain
