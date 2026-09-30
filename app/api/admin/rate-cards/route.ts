import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

const allowed = new Set(["application/pdf", "text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
const MAX_BYTES = 10 * 1024 * 1024;
type AccountCode = "04" | "08" | "other";
type MatrixRow = { origin_zone: string; destination_zone: string; rate_per_kg: number };
const ZONES: Record<AccountCode, string[]> = { "04": ["N1", "N2", "E", "NE", "W1", "W2", "S1", "S2", "Central"], "08": ["N1", "N2", "E", "NE", "W1", "W2", "S1", "S2", "Central"], other: ["N1", "N2", "N3", "N4", "C1", "C2", "W1", "W2", "S1", "S2", "S3", "S4", "E1", "E2", "NE1", "NE2"] };

function csvRows(text: string): string[][] {
  return text.trim().split(/\r?\n/).map((line) => line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((cell) => cell.trim().replace(/^"|"$/g, "")));
}

function matrixFromRows(rows: string[][], accountCode: AccountCode): MatrixRow[] | null {
  const zones = ZONES[accountCode];
  const headerIndex = rows.findIndex((row) => zones.filter((zone) => row.some((cell) => cell.trim() === zone)).length >= Math.min(3, zones.length));
  if (headerIndex < 0) return null;
  const header = rows[headerIndex];
  const columns = new Map<string, number>();
  header.forEach((cell, index) => { const zone = cell.trim(); if (zones.includes(zone)) columns.set(zone, index); });
  if (columns.size !== zones.length) return null;
  const result: MatrixRow[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const origin = row.find((cell) => zones.includes(cell.trim()))?.trim();
    if (!origin) continue;
    for (const destination of zones) {
      const value = Number(row[columns.get(destination) ?? -1]);
      if (!Number.isFinite(value) || value < 0) return null;
      result.push({ origin_zone: origin, destination_zone: destination, rate_per_kg: value });
    }
  }
  return result.length === zones.length * zones.length && new Set(result.map((row) => `${row.origin_zone}->${row.destination_zone}`)).size === result.length ? result : null;
}

function xmlText(value: string) { return value.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim(); }

function cellColumn(reference: string) { const letters = reference.replace(/\d/g, ""); return letters.split("").reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1; }

async function inflateRaw(bytes: Uint8Array) {
  const stream = new DecompressionStream("deflate-raw" as CompressionFormat);
  const response = new Response(new Blob([bytes.slice().buffer as ArrayBuffer]).stream().pipeThrough(stream));
  return new Uint8Array(await response.arrayBuffer());
}

async function zipEntries(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index -= 1) if (view.getUint32(index, true) === 0x06054b50) { eocd = index; break; }
  if (eocd < 0) throw new Error("XLSX archive directory is missing");
  const count = view.getUint16(eocd + 10, true); const directoryOffset = view.getUint32(eocd + 16, true); const entries = new Map<string, Uint8Array>(); let cursor = directoryOffset;
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("XLSX archive entry is invalid");
    const method = view.getUint16(cursor + 10, true); const compressedSize = view.getUint32(cursor + 20, true); const nameLength = view.getUint16(cursor + 28, true); const extraLength = view.getUint16(cursor + 30, true); const commentLength = view.getUint16(cursor + 32, true); const localOffset = view.getUint32(cursor + 42, true); const name = new TextDecoder().decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    const localNameLength = view.getUint16(localOffset + 26, true); const localExtraLength = view.getUint16(localOffset + 28, true); const compressed = bytes.slice(localOffset + 30 + localNameLength + localExtraLength, localOffset + 30 + localNameLength + localExtraLength + compressedSize);
    entries.set(name, method === 0 ? compressed : method === 8 ? await inflateRaw(compressed) : (() => { throw new Error("Unsupported XLSX compression"); })());
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function xlsxRows(bytes: Uint8Array): Promise<string[][]> {
  const entries = await zipEntries(bytes); const workbook = new TextDecoder().decode(entries.get("xl/workbook.xml")); const rels = new TextDecoder().decode(entries.get("xl/_rels/workbook.xml.rels"));
  const sheets = [...workbook.matchAll(/<sheet\b[^>]*>/gi)]; const sheet = sheets.map((match) => match[0]).map((tag) => ({ name: tag.match(/\bname="([^"]+)"/i)?.[1] ?? "", id: tag.match(/\br:id="([^"]+)"/i)?.[1] ?? "" })).find((item) => /b2b/i.test(item.name)) ?? sheets.map((match) => match[0]).map((tag) => ({ name: tag.match(/\bname="([^"]+)"/i)?.[1] ?? "", id: tag.match(/\br:id="([^"]+)"/i)?.[1] ?? "" }))[0]; if (!sheet?.id) throw new Error("XLSX worksheet is missing");
  const relation = rels.match(new RegExp(`<Relationship\\b[^>]*Id="${sheet.id}"[^>]*Target="([^"]+)"`, "i")); const target = relation?.[1] ?? "worksheets/sheet1.xml"; const sheetPath = target.startsWith("/") ? target.slice(1) : target.startsWith("xl/") ? target : `xl/${target}`;
  const shared = entries.get("xl/sharedStrings.xml") ? new TextDecoder().decode(entries.get("xl/sharedStrings.xml")) : ""; const strings = [...shared.matchAll(/<si[\s\S]*?<\/si>/g)].map((match) => xmlText(match[0])); const xml = new TextDecoder().decode(entries.get(sheetPath));
  return [...xml.matchAll(/<row\b[\s\S]*?<\/row>/g)].map((rowMatch) => { const cells: string[] = []; for (const cell of rowMatch[0].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) { const attrs = cell[1]; const reference = attrs.match(/\br="([A-Z]+\d+)"/i)?.[1] ?? "A1"; const index = cellColumn(reference); const type = attrs.match(/\bt="([^"]+)"/)?.[1]; const raw = type === "inlineStr" ? xmlText(cell[2]) : cell[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? ""; cells[index] = type === "s" ? strings[Number(raw)] ?? "" : raw; } return cells.map((cell) => cell ?? ""); });
}

async function normalizeSource(file: File, accountCode: AccountCode): Promise<{ rows: MatrixRow[] | null; status: "normalized" | "manual_review" | "failed" }> {
  if (file.type === "application/pdf") return { rows: null, status: "manual_review" };
  try { const bytes = new Uint8Array(await file.arrayBuffer()); const rows = file.type === "text/csv" || file.type === "application/vnd.ms-excel" ? csvRows(new TextDecoder().decode(bytes)) : await xlsxRows(bytes); const matrix = matrixFromRows(rows, accountCode); return matrix ? { rows: matrix, status: "normalized" } : { rows: null, status: "failed" }; } catch { return { rows: null, status: "failed" }; }
}

export async function GET() {
  await requireSuperAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.from("rate_cards").select("id,client_id,account_code,object_path,original_filename,mime_type,byte_size,normalized_matrix_json,normalization_status,updated_at,client_accounts(legal_name,client_code)").order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Unable to load rate cards." }, { status: 500 });
  return NextResponse.json({ rateCards: data ?? [] });
}

export async function POST(request: Request) {
  const actor = await requireSuperAdmin();
  const form = await request.formData(); const clientId = String(form.get("clientId") ?? ""); const accountCode = String(form.get("accountCode") ?? "other").trim().toLowerCase(); const file = form.get("file");
  if (!clientId || !["04", "08", "other"].includes(accountCode) || !(file instanceof File)) return NextResponse.json({ error: "A client, Delhivery B2B account, and rate-card file are required." }, { status: 400 });
  if (!allowed.has(file.type) || file.size < 1 || file.size > MAX_BYTES) return NextResponse.json({ error: "Upload a PDF, CSV, or XLSX file up to 10 MB." }, { status: 400 });
  const normalized = await normalizeSource(file, accountCode as AccountCode);
  if (normalized.status === "failed") return NextResponse.json({ error: "The uploaded matrix could not be normalized. Check that it contains the expected directional zone table, then upload it again." }, { status: 400 });
  const admin = createAdminClient();
  const { data: client } = await admin.from("client_accounts").select("id").eq("id", clientId).maybeSingle();
  if (!client) return NextResponse.json({ error: "Client account was not found." }, { status: 404 });
  const { data: previous } = await admin.from("rate_cards").select("id,object_path").eq("client_id", clientId).eq("account_code", accountCode).maybeSingle();
  const extension = file.type === "application/pdf" ? "pdf" : file.type === "text/csv" || file.type === "application/vnd.ms-excel" ? "csv" : "xlsx";
  const objectPath = `${clientId}/${crypto.randomUUID()}.${extension}`;
  const upload = await admin.storage.from("rate-cards").upload(objectPath, file, { contentType: file.type, upsert: false });
  if (upload.error) return NextResponse.json({ error: "Unable to upload rate card." }, { status: 500 });
  const { data: saved, error } = await admin.from("rate_cards").upsert({ client_id: clientId, account_code: accountCode, object_path: objectPath, original_filename: file.name, mime_type: file.type, byte_size: file.size, normalized_matrix_json: normalized.rows, normalization_status: normalized.status, uploaded_by: actor.userId, updated_at: new Date().toISOString() }, { onConflict: "client_id,account_code" }).select("id,client_id,account_code,original_filename,mime_type,byte_size,normalized_matrix_json,normalization_status,updated_at").single();
  if (error) { await admin.storage.from("rate-cards").remove([objectPath]); return NextResponse.json({ error: "Unable to save rate-card metadata." }, { status: 500 }); }
  // Preserve the previous object because published pricing versions may reference it for audit history.
  await admin.from("admin_audit_events").insert({ actor_user_id: actor.userId, action: previous ? "Replaced rate card" : "Uploaded rate card", entity_type: "Client", entity_id: clientId, before_state: previous ? { objectPath: previous.object_path, accountCode } : null, after_state: { objectPath, filename: file.name, accountCode } });
  return NextResponse.json({ rateCard: saved }, { status: previous ? 200 : 201 });
}

export async function PATCH(request: Request) {
  await requireSuperAdmin();
  const { clientId, cardId } = await request.json() as { clientId?: string; cardId?: string };
  if (!clientId && !cardId) return NextResponse.json({ error: "clientId or cardId is required." }, { status: 400 });
  const admin = createAdminClient(); let query = admin.from("rate_cards").select("object_path"); if (cardId) query = query.eq("id", cardId); else query = query.eq("client_id", clientId!); const { data } = await query.maybeSingle();
  if (!data) return NextResponse.json({ error: "Rate card was not found." }, { status: 404 });
  const signed = await admin.storage.from("rate-cards").createSignedUrl(data.object_path, 60);
  if (signed.error) return NextResponse.json({ error: "Unable to prepare download." }, { status: 500 });
  return NextResponse.json({ url: signed.data.signedUrl });
}
