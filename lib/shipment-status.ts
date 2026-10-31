export type ShipmentStatusTab = "All" | "Active" | "Booked" | "In Transit" | "Out for Delivery" | "Delivered" | "Delayed" | "Exception" | "Returned" | "Cancelled";

export function shipmentStatusTabCounts(
  total: number | null | undefined,
  statusCounts: Record<string, number>,
  loadedCounts: Record<ShipmentStatusTab, number>,
): Record<ShipmentStatusTab, number> {
  if (!Object.keys(statusCounts).length) return loadedCounts;
  const count = (...keys: string[]) => keys.reduce((sum, key) => sum + Math.max(0, Number(statusCounts[key]) || 0), 0);
  const all = Number.isFinite(total) ? Math.max(0, Number(total)) : Object.values(statusCounts).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  return {
    All: all,
    Active: Math.max(0, all - count("delivered", "returned", "rto", "cancelled", "canceled")),
    // Keep the tab badge aligned with the Worker `status=booked` predicate.
    // Provider-pending, manifested, and locally-created rows still belong to
    // the booking queue until the shipment moves into transit.
    Booked: count("created", "booked", "provider_pending", "manifested"),
    "In Transit": count("picked_up", "in_transit"),
    "Out for Delivery": count("out_for_delivery"),
    Delivered: count("delivered"),
    Delayed: count("delayed"),
    Exception: count("exception"),
    Returned: count("returned", "rto"),
    Cancelled: count("cancelled", "canceled"),
  };
}
