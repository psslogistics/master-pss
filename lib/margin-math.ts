export type MarginInput = {
  client_id?: string | null;
  pss_amount?: number | string | null;
  provider_amount?: number | string | null;
  provider_status?: string | null;
};

export type MarginSummary = {
  shipments: number;
  billed: number;
  matchedBilled: number;
  providerCost: number;
  margin: number;
  pending: number;
};

export type ClientMarginSummary = MarginSummary & { clientId: string };

export function marginAmount(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function marginFor(input: MarginInput): number | null {
  const billed = marginAmount(input.pss_amount);
  const providerStatus = input.provider_status?.trim().toLowerCase();
  const cost = providerStatus === "failed" || providerStatus === "rejected" || providerStatus === "error"
    ? null
    : marginAmount(input.provider_amount);
  return billed === null || cost === null ? null : roundCurrency(billed - cost);
}

export function summarizeMargins<T extends MarginInput>(rows: T[]): MarginSummary {
  return rows.reduce<MarginSummary>((summary, row) => {
    const billed = marginAmount(row.pss_amount);
    const providerStatus = row.provider_status?.trim().toLowerCase();
    const cost = providerStatus === "failed" || providerStatus === "rejected" || providerStatus === "error"
      ? null
      : marginAmount(row.provider_amount);
    const margin = marginFor(row);
    summary.shipments += 1;
    if (billed !== null) summary.billed += billed;
    if (margin === null || billed === null || cost === null) {
      summary.pending += 1;
      return summary;
    }
    summary.matchedBilled += billed;
    summary.providerCost += cost;
    summary.margin += margin;
    return summary;
  }, { shipments: 0, billed: 0, matchedBilled: 0, providerCost: 0, margin: 0, pending: 0 });
}

export function summarizeMarginsByClient<T extends MarginInput>(rows: T[]): ClientMarginSummary[] {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const clientId = row.client_id?.trim() || "unknown";
    grouped.set(clientId, [...(grouped.get(clientId) ?? []), row]);
  }
  return [...grouped.entries()]
    .map(([clientId, items]) => ({ clientId, ...summarizeMargins(items) }))
    .sort((left, right) => right.margin - left.margin);
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
