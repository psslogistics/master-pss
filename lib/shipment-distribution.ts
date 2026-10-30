export type ShipmentDistribution = {
  total: number;
  delivered: number;
  inMovement: number;
  delayed: number;
  exception: number;
};

const normalizeStatus = (value: string) => value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

export function getShipmentDistribution(
  total: number,
  statusCounts: Record<string, number>,
  delayedCount: number,
): ShipmentDistribution {
  const safeTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
  const entries = Object.entries(statusCounts).map(([status, count]) => [normalizeStatus(status), Number(count) || 0] as const);
  const countMatching = (matches: (status: string) => boolean) => entries.reduce((sum, [status, count]) => sum + (matches(status) ? count : 0), 0);
  const percent = (count: number) => safeTotal ? Math.min(100, Math.round((Math.max(0, count) / safeTotal) * 100)) : 0;

  return {
    total: safeTotal,
    delivered: percent(countMatching((status) => ["delivered", "delivery complete", "delivery completed"].includes(status))),
    inMovement: percent(countMatching((status) => ["in transit", "picked up", "out for delivery"].includes(status))),
    delayed: percent(delayedCount),
    exception: percent(countMatching((status) => status.includes("exception") || status.includes("fail") || status.includes("ndr"))),
  };
}
