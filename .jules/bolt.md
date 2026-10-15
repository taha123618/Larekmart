## 2026-10-15 - React Component Re-render Optimization
**Learning:** Destructuring whole stores from Zustand without selectors forces re-renders of the component whenever *any* unrelated state inside the store changes.
**Action:** Use precise Zustand selectors `useStore(state => state.field)` instead of destructured `const { field } = useStore()` to minimize component re-renders. Always combine this with `React.memo` safely.
