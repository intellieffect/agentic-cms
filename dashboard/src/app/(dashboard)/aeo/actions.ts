"use server";

import { loadResultsForCell, type AeoEngine } from "@/lib/aeo";

export async function fetchCellResults(
  queryId: string,
  engine: AeoEngine,
  runDate: string,
) {
  return loadResultsForCell(queryId, engine, runDate);
}
