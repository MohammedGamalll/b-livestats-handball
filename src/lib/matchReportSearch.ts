export type MatchReportSearch = {
  matchId?: string;
  print?: string;
};

export function matchReportSearch(search: Record<string, unknown>): MatchReportSearch {
  const matchId = typeof search.matchId === "string" && search.matchId.trim() ? search.matchId.trim() : undefined;
  const print = typeof search.print === "string" ? search.print : undefined;
  return { matchId, print };
}
