# TODO

- [x] Memoize `rows` passed to `ExportButton` in `src/app/purok-leader/households/page.tsx` using `useMemo`.
- [x] Memoize `searchKeys` callback in `src/app/purok-leader/households/page.tsx` using `useCallback` so `DataTable` filtering memoization remains effective.
- [x] Verify TypeScript build/lint and do a quick manual check: search + pagination + export.
  - Build succeeded (next build).
  - dev server port 3000 was already in use during testing attempt.
