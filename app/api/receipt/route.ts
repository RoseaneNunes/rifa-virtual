import { NextResponse } from "next/server";
import { NUMBERS_SET } from "../../lib/rifa";

const UPLOAD_URL = process.env.RECEIPT_UPLOAD_URL ?? "";
const SHARED_SECRET = process.env.RECEIPT_SHARED_SECRET ?? "";

// Limite de 4 MB: o corpo de uma função serverless na Vercel vai até ~4,5 MB.
const MAX_BYTES = 4 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

const ALLOWED_EXTENSIONS: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  pdf: "application/pdf",
};

// Alguns aparelhos enviam o arquivo sem MIME (ou como octet-stream); nesse
// caso usamos a extensão.
function resolveMime(file: File): string | null {
  const type = file.type;
  if (type && type !== "application/octet-stream") {
    return ALLOWED_TYPES.has(type) ? type : null;
  }
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  return ALLOWED_EXTENSIONS[ext] ?? null;
}

type ReceiptPayload = {
  ok: boolean;
  url?: string;
  error?: string;
};

function json(payload: ReceiptPayload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!UPLOAD_URL) {
    return json({ ok: false, error: "not_configured" }, 503);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "invalid_form" }, 400);
  }

  const file = form.get("comprovante");
  if (!file || typeof file === "string" || file.size === 0) {
    return json({ ok: false, error: "missing_file" }, 400);
  }
  if (file.size > MAX_BYTES) {
    return json({ ok: false, error: "file_too_large" }, 413);
  }

  const mimeType = resolveMime(file);
  if (!mimeType) {
    return json({ ok: false, error: "invalid_type" }, 415);
  }

  const numero = String(form.get("numero") ?? "").replace(/\D/g, "");
  const nome = String(form.get("nome") ?? "").trim();
  const telefone = String(form.get("telefone") ?? "").trim();

  // O endpoint é público: só aceita reservas de números realmente disponíveis.
  const numeroNum = Number.parseInt(numero, 10);
  if (!numero || !NUMBERS_SET.has(numeroNum)) {
    return json({ ok: false, error: "invalid_numero" }, 400);
  }
  if (nome.length < 3) {
    return json({ ok: false, error: "invalid_nome" }, 400);
  }
  if (telefone.replace(/\D/g, "").length < 10) {
    return json({ ok: false, error: "invalid_telefone" }, 400);
  }

  const dataBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  try {
    const res = await fetch(UPLOAD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: SHARED_SECRET,
        filename: file.name,
        mimeType,
        dataBase64,
        numero,
        nome,
        telefone,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });

    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      url?: string;
      error?: string;
    } | null;

    if (!res.ok || !data?.ok) {
      return json(
        { ok: false, error: data?.error ?? `upload_http_${res.status}` },
        502
      );
    }

    return json({ ok: true, url: data.url });
  } catch {
    return json({ ok: false, error: "upload_failed" }, 502);
  }
}
