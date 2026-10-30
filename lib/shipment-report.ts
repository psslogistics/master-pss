export type ShipmentReportRow = {
  id: string;
  client_id: string;
  pss_reference?: string | null;
  lr_number?: string | null;
  master_awb?: string | null;
  provider_reference?: string | null;
  tracking_number?: string | null;
  provider?: string | null;
  origin?: string | null;
  destination?: string | null;
  status?: string | null;
  total_weight_kg?: number | null;
  pieces?: number | null;
  declared_value?: number | null;
  created_at?: string | null;
  edd?: string | null;
  delivered_at?: string | null;
  delay_days?: number | null;
};

export type ShipmentReportFilters = {
  query?: string;
  clientId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
};

export const shipmentReportColumns: Array<[string, (row: ShipmentReportRow) => unknown]> = [
  ["Shipment ID", (row) => row.id], ["PSS reference", (row) => row.pss_reference], ["LR / LRN", (row) => row.lr_number],
  ["Master AWB", (row) => row.master_awb], ["Provider reference", (row) => row.provider_reference], ["Tracking number", (row) => row.tracking_number],
  ["Client ID", (row) => row.client_id], ["Courier", (row) => row.provider], ["Origin", (row) => row.origin], ["Destination", (row) => row.destination],
  ["Status", (row) => row.status], ["Weight (kg)", (row) => row.total_weight_kg], ["Pieces", (row) => row.pieces],
  ["Declared value", (row) => row.declared_value], ["Booked at", (row) => row.created_at], ["ETA", (row) => row.edd],
  ["Delivered at", (row) => row.delivered_at], ["Delay days", (row) => row.delay_days],
];

export function filterShipmentReportRows(rows: ShipmentReportRow[], filters: ShipmentReportFilters) {
  const needle = filters.query?.trim().toLowerCase() ?? "";
  return rows.filter((row) => {
    if (filters.clientId && row.client_id !== filters.clientId) return false;
    if (filters.status && String(row.status ?? "Unknown") !== filters.status) return false;
    const booked = String(row.created_at ?? "").slice(0, 10);
    if (filters.dateFrom && (!booked || booked < filters.dateFrom)) return false;
    if (filters.dateTo && (!booked || booked > filters.dateTo)) return false;
    return !needle || shipmentReportColumns.some(([, value]) => String(value(row) ?? "").toLowerCase().includes(needle));
  });
}

function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);
  // Prevent spreadsheet programs from evaluating shipment/client data as formulas.
  const text = /^[\s\u0000-\u001f]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replaceAll('"', '""')}"`;
}

export function shipmentReportCsv(rows: ShipmentReportRow[], generatedAt: string, clientName: (id: string) => string) {
  const generated = new Date(generatedAt);
  if (!Number.isFinite(generated.getTime())) throw new Error("A valid report generation timestamp is required.");
  const header = ["Generated at", generated.toISOString(), "Rows", String(rows.length)].map(csvCell).join(",");
  const body = [[...shipmentReportColumns.map(([label]) => label), "Client name"].map(csvCell).join(","), ...rows.map((row) => [...shipmentReportColumns.map(([, getValue]) => getValue(row)), clientName(row.client_id)].map(csvCell).join(","))].join("\r\n");
  return `${header}\r\n${body}\r\n`;
}

export function shipmentReportFilename(generatedAt: string) {
  const generated = new Date(generatedAt);
  if (!Number.isFinite(generated.getTime())) throw new Error("A valid report generation timestamp is required.");
  return `pss-shipment-report-${generated.toISOString().slice(0, 10)}.csv`;
}
