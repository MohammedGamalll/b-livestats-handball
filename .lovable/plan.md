## Goal
Filter dropdown in Standings should list **all competition types available in Game Information** (`COMPETITION_OPTIONS`), not only the competitions that already have saved matches.

## Change
`src/routes/standings.tsx`:
- Import `COMPETITION_OPTIONS` from `@/lib/handball`.
- Replace the `competitions` array (derived from matches) with `COMPETITION_OPTIONS` so every option from Game Information shows in the filter, even before any match is played for it.
- Keep the rest of the logic as-is: "All competitions" shows all non-Cup matches in the standings table, selecting a specific competition filters both the table and results list. Cup remains excluded from points aggregation.

No other files change.
