import { connection, NextResponse } from "next/server";

const CSV_URL = process.env.SHEET_CSV_URL ?? "";
const COLUMN = (process.env.SHEET_NUMERO_COLUMN ?? "numero da rifa").trim();

type ReservedPayload = {
  reserved: number[];
  configured: boolean;
  total?: number;
  error?: string;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      // ignore, handled by \n
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function toNumber(value: string): number | null {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  await connection();

  if (!CSV_URL) {
    return NextResponse.json<ReservedPayload>(
      { reserved: [], configured: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json<ReservedPayload>(
        { reserved: [], configured: true, error: `http_${res.status}` },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    const rows = parseCsv(await res.text());
    if (rows.length === 0) {
      return NextResponse.json<ReservedPayload>(
        { reserved: [], configured: true, total: 0 },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const header = rows[0].map(normalize);
    const wanted = normalize(COLUMN);
    let index = header.indexOf(wanted);
    if (index === -1) {
      index = header.findIndex((h) => h.includes("numero") || h.includes("nº"));
    }
    if (index === -1) {
      index = rows[0].length - 1;
    }

    const reserved = new Set<number>();
    for (const line of rows.slice(1)) {
      const value = line[index] ?? "";
      const n = toNumber(value);
      if (n !== null) reserved.add(n);
    }

    const list = Array.from(reserved).sort((a, b) => a - b);

    return NextResponse.json<ReservedPayload>(
      { reserved: list, configured: true, total: rows.length - 1 },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json<ReservedPayload>(
      { reserved: [], configured: true, error: "fetch_failed" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
