import assert from "node:assert/strict";
import test from "node:test";
import { filterShipmentReportRows, shipmentReportCsv, shipmentReportFilename } from "./shipment-report.ts";

const rows = [
  { id: "id-1", client_id: "client-a", pss_reference: "PSS-001", lr_number: "LR-101", status: "Delivered", created_at: "2026-10-02T10:00:00Z", delay_days: 0 },
  { id: "id-2", client_id: "client-b", pss_reference: "PSS-002", lr_number: "LR-202", status: "In Transit", created_at: "2026-10-10T10:00:00Z", delay_days: 2 },
  { id: "id-3", client_id: "client-a", pss_reference: "PSS-003", status: null, created_at: null },
];

test("report filters combine client, status, inclusive date bounds, and case-insensitive identifiers", () => {
  assert.deepEqual(filterShipmentReportRows(rows, {
    clientId: "client-a", status: "Delivered", dateFrom: "2026-10-02", dateTo: "2026-10-02", query: "lr-101",
  }).map((row) => row.id), ["id-1"]);
});

test("date bounds exclude missing booking dates and reversed bounds return no records", () => {
  assert.deepEqual(filterShipmentReportRows(rows, { dateFrom: "2026-10-01" }).map((row) => row.id), ["id-1", "id-2"]);
  assert.deepEqual(filterShipmentReportRows(rows, { dateFrom: "2026-10-11", dateTo: "2026-10-01" }), []);
});

test("empty filters preserve all rows and status filtering handles missing status", () => {
  assert.deepEqual(filterShipmentReportRows(rows, {}).map((row) => row.id), ["id-1", "id-2", "id-3"]);
  assert.deepEqual(filterShipmentReportRows(rows, { status: "Unknown" }).map((row) => row.id), ["id-3"]);
});

test("CSV quotes cells, neutralizes formula values, and carries client and generation metadata", () => {
  const row = { ...rows[0], origin: '=HYPERLINK("https://bad.invalid")', destination: "  @SUM(1,1)", pieces: -1 };
  const csv = shipmentReportCsv([row], "2026-10-30T12:00:00.000Z", () => 'Acme, "North"');
  assert.match(csv, /Generated at","2026-10-30T12:00:00\.000Z","Rows","1"/);
  assert.ok(csv.includes(`"'=HYPERLINK(""https://bad.invalid"")"`));
  assert.match(csv, /'  @SUM/);
  assert.match(csv, /'\-1/);
  assert.match(csv, /"Acme, ""North"""/);
});

test("CSV timestamp validation and deterministic filename protect invalid metadata", () => {
  assert.equal(shipmentReportFilename("2026-10-30T23:59:00.000Z"), "pss-shipment-report-2026-10-30.csv");
  assert.throws(() => shipmentReportCsv([], "not-a-date", () => ""), /valid report generation timestamp/);
  assert.throws(() => shipmentReportFilename("not-a-date"), /valid report generation timestamp/);
});
