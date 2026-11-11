"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { PIX_KEY, PIX_NAME } from "./lib/pix";
import { NUMBERS } from "./lib/rifa";

const FORM_ACTION =
  "https://docs.google.com/forms/d/e/1FAIpQLSfh-aQa_VrZI7SI7Ihrc6VyoHhsueVzTdYSNHxUs5Wk5EeMKw/formResponse";

const ENTRY = {
  nome: "entry.215673668",
  numero: "entry.131190346",
  telefone: "entry.1086276901",
};

// Comprovante de pagamento (obrigatório): enviado para /api/receipt, que
// repassa o arquivo para o Google Drive via Apps Script.
const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;
const RECEIPT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
];
const RECEIPT_EXTENSIONS: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  pdf: "application/pdf",
};

// Alguns aparelhos enviam o arquivo sem MIME (ou como octet-stream); nesse
// caso a extensão define o tipo aceito.
function receiptMime(file: File): string | null {
  const type = file.type;
  if (type && type !== "application/octet-stream") {
    return RECEIPT_TYPES.includes(type) ? type : null;
  }
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  return RECEIPT_EXTENSIONS[ext] ?? null;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const PRIZES = [
  { medal: "🥇", place: "1º lugar", value: "R$ 150,00" },
  { medal: "🥈", place: "2º lugar", value: "R$ 100,00" },
  { medal: "🥉", place: "3º lugar", value: "R$ 50,00" },
];

const CONFETTI_COLORS = [
  "#04d361",
  "#a56fee",
  "#d2adff",
  "#00ff73",
  "#00ee6b",
  "#7e45ca",
];

const IMG = "/Knex logo vetor.svg";

const TAKEN_KEY = "knex-rifa-reservados";
const TAKEN_EVENT = "knex-rifa";

function subscribeTaken(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(TAKEN_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(TAKEN_EVENT, callback);
  };
}

function getTakenSnapshot() {
  return localStorage.getItem(TAKEN_KEY) ?? "[]";
}

function getTakenServerSnapshot() {
  return "[]";
}

function parseTaken(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTaken(next: number[]) {
  try {
    localStorage.setItem(TAKEN_KEY, JSON.stringify(next));
  } catch {}
  window.dispatchEvent(new Event(TAKEN_EVENT));
}

type Confetti = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
};

function buildConfetti(): Confetti[] {
  return Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.2,
    duration: 2.4 + Math.random() * 1.8,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  }));
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.replace(/(\d{0,2})/, "($1");
  if (digits.length <= 6) return digits.replace(/(\d{2})(\d{0,5})/, "($1) $2");
  if (digits.length <= 10)
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

export default function Home() {
  const [selected, setSelected] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [clicked, setClicked] = useState<number | null>(null);
  const [confetti, setConfetti] = useState<Confetti[]>([]);
  const [serverReserved, setServerReserved] = useState<number[]>([]);
  const [configured, setConfigured] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const localTakenRaw = useSyncExternalStore(
    subscribeTaken,
    getTakenSnapshot,
    getTakenServerSnapshot
  );
  const localTaken = useMemo(() => parseTaken(localTakenRaw), [localTakenRaw]);

  const taken = useMemo(
    () => Array.from(new Set([...serverReserved, ...localTaken])),
    [serverReserved, localTaken]
  );

  const takenAvailable = useMemo(
    () => taken.filter((n) => NUMBERS.includes(n)),
    [taken]
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/reserved", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) {
          if (Array.isArray(data?.reserved)) setServerReserved(data.reserved);
          setConfigured(Boolean(data?.configured));
        }
      } catch {
        
      }
    };

    load();
    const interval = window.setInterval(load, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [refreshKey]);

  useEffect(() => {
    const nodes = rootRef.current?.querySelectorAll<HTMLElement>(".reveal");
    if (!nodes) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
        setNome("");
        setTelefone("");
        setReceipt(null);
        setReceiptError(null);
        setSubmitError(null);
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [selected]);

  const resetForm = () => {
    setCopied(null);
    setNome("");
    setTelefone("");
    setReceipt(null);
    setReceiptError(null);
    setSubmitError(null);
  };

  const closeModal = () => {
    if (submitting) return;
    setSelected(null);
    resetForm();
  };

  const copy = async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(tag);
    window.setTimeout(() => setCopied(null), 2000);
  };

  const copyPixKey = () => copy(PIX_KEY, "key");

  const handleSelect = (n: number, e: React.MouseEvent<HTMLButtonElement>) => {
    if (taken.includes(n)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--x", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--y", `${e.clientY - rect.top}px`);
    setClicked(n);
    window.setTimeout(() => setClicked(null), 450);
    window.setTimeout(() => setSelected(n), 180);
  };

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSubmitError(null);

    if (!file) {
      setReceipt(null);
      setReceiptError(null);
      return;
    }

    if (!receiptMime(file)) {
      setReceipt(null);
      setReceiptError("Formato inválido. Envie JPG, PNG, WEBP, HEIC ou PDF.");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_RECEIPT_BYTES) {
      setReceipt(null);
      setReceiptError(
        `Arquivo muito grande (${formatBytes(file.size)}). Máximo de 4 MB.`
      );
      e.target.value = "";
      return;
    }

    setReceipt(file);
    setReceiptError(null);
  };

  const valid = useMemo(
    () =>
      nome.trim().length >= 3 &&
      telefone.replace(/\D/g, "").length >= 10 &&
      receipt !== null &&
      receiptError === null,
    [nome, telefone, receipt, receiptError]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || selected === null || submitting || !receipt) return;
    setSubmitting(true);
    setSubmitError(null);

    // 1) O comprovante é obrigatório: só reserva se o upload der certo.
    try {
      const receiptBody = new FormData();
      receiptBody.append("comprovante", receipt);
      receiptBody.append("numero", String(selected));
      receiptBody.append("nome", nome.trim());
      receiptBody.append("telefone", telefone);

      const res = await fetch("/api/receipt", {
        method: "POST",
        body: receiptBody,
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setSubmitting(false);
        setSubmitError(
          data?.error === "not_configured"
            ? "O envio de comprovante está indisponível no momento. Fale com a organização."
            : "Não foi possível enviar o comprovante. Tente novamente."
        );
        return;
      }
    } catch {
      setSubmitting(false);
      setSubmitError(
        "Não foi possível enviar o comprovante. Verifique sua conexão e tente novamente."
      );
      return;
    }

    // 2) Com o comprovante salvo, registra a reserva no Google Forms.
    const body = new URLSearchParams();
    body.append(ENTRY.nome, nome.trim());
    body.append(ENTRY.numero, String(selected));
    body.append(ENTRY.telefone, telefone);

    try {
      await fetch(FORM_ACTION, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
    } catch {
     
    }

    saveTaken(Array.from(new Set([...taken, selected])));
    setConfetti(buildConfetti());
    setSubmitting(false);
    setSuccess(true);

    [4000, 12000, 30000].forEach((ms) =>
      window.setTimeout(() => setRefreshKey((k) => k + 1), ms)
    );
  };

  const closeSuccess = () => {
    setSuccess(false);
    setSelected(null);
    resetForm();
  };

  return (
    <div ref={rootRef} className="bg-aurora flex-1">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-p0/70 border-b border-pp3/15">
        <div className="mx-auto max-w-6xl px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={IMG} alt="Logo da Knex Jr" className="h-10 w-10" />
            <div className="leading-tight">
              <p className="font-bold text-w0">KNEX Jr</p>
              <p className="text-[11px] text-pp4">Consultoria · UEPB</p>
            </div>
          </div>
          <a
            href="https://www.instagram.com/vempraknex/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary rounded-full px-4 py-2 text-sm font-bold"
          >
            @vempraknex
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5">
        {/* Hero */}
        <section className="reveal pt-14 pb-10 text-center flex flex-col items-center gap-5">
          <img
            src={IMG}
            alt="Logo da Knex Jr"
            className="h-24 w-24 float drop-shadow-[0_0_40px_rgba(4,211,97,0.45)]"
          />
          <span className="rounded-full border border-g3/40 bg-g2/10 px-4 py-1.5 text-sm text-gg5">
            🚀 Aurora · 21 e 22 de novembro
          </span>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-w0 text-glow">
            Rifa da <span className="text-g3">Knex Jr</span>
          </h1>
          <p className="max-w-2xl text-w3 text-base sm:text-lg leading-relaxed">
            Estamos arrecadando fundos para custear a participação dos nossos
            integrantes no <strong className="text-pp4">Aurora</strong>, evento
            voltado para Empresas Juniores. Toda ajuda faz a diferença! 💚
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="#numeros"
              className="btn-primary rounded-full px-6 py-3 font-bold"
            >
              Escolher meu número 🍀
            </a>
            <span className="rounded-full card px-5 py-3 text-w2">
              Cada número: <strong className="text-g3">R$ 5,00</strong>
            </span>
          </div>
        </section>

        {/* Prizes */}
        <section className="reveal pb-12">
          <h2 className="mb-5 text-center text-2xl sm:text-3xl font-bold text-w0">
            🎁 Confira os prêmios
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {PRIZES.map((p) => (
              <div
                key={p.place}
                className="card rounded-2xl p-6 text-center transition-transform hover:-translate-y-1"
              >
                <div className="text-4xl">{p.medal}</div>
                <p className="mt-2 text-w3">{p.place}</p>
                <p className="text-3xl font-extrabold text-g3">{p.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Numbers */}
        <section id="numeros" className="reveal scroll-mt-24 pb-16">
          <h2 className="mb-2 text-center text-2xl sm:text-3xl font-bold text-w0">
            Escolha o seu número da sorte
          </h2>
          <p className="mb-6 text-center text-w4">
            {NUMBERS.length} números disponíveis · clique para reservar
          </p>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10">
            {NUMBERS.map((n) => {
              const isTaken = taken.includes(n);
              return (
                <button
                  key={n}
                  onClick={(e) => handleSelect(n, e)}
                  disabled={isTaken}
                  className={`number-btn rounded-xl py-4 text-lg font-bold text-w0 ${
                    clicked === n ? "clicked" : ""
                  } ${isTaken ? "taken" : ""}`}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-center text-xs text-w5">
            {takenAvailable.length === 0
              ? "Todos os números estão disponíveis. Boa sorte! 🍀"
              : configured
                ? `${takenAvailable.length} de ${NUMBERS.length} número(s) já reservado(s).`
                : `${takenAvailable.length} número(s) reservado(s) neste dispositivo.`}
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-pp3/15 bg-footer">
        <div className="mx-auto max-w-6xl px-5 py-10 text-center">
          <img src={IMG} alt="Knex Jr" className="mx-auto h-14 w-14" />
          <p className="mt-3 font-bold text-w0">KNEX Jr Consultoria</p>
          <p className="text-sm text-w4">
            Empresa Júnior de Computação · UEPB Campus VII
          </p>
          <a
            href="https://www.instagram.com/vempraknex/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-g3 hover:text-g5"
          >
            @vempraknex
          </a>
          <p className="mt-6 text-xs text-w5">
            Boa sorte a todos e muito obrigado pelo apoio! 💚
          </p>
        </div>
      </footer>

      {/* Modal */}
      {selected !== null && (
        <div
          className="overlay fixed inset-0 z-50 flex items-center justify-center bg-p0/80 p-4 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="modal-panel card max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-sm text-pp4">Você escolheu</p>
                <p className="text-3xl font-extrabold text-g3">
                  Número {selected}
                </p>
              </div>
              <button
                onClick={closeModal}
                aria-label="Fechar"
                className="text-w4 transition-colors hover:text-w0"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-[auto_1fr]">
              {/* Pix */}
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-2xl bg-w0 p-3 shadow-[0_10px_40px_-10px_rgba(4,211,97,0.6)]">
                  <img
                    src="/QRCODE.jpeg"
                    alt="QR Code Pix"
                    width={196}
                    height={196}
                    className="h-[196px] w-[196px] rounded-xl object-cover"
                  />
                </div>

                <div className="text-center">
                  <p className="text-xs text-w5">Pague R$ 5,00 escaneando</p>
                  <p className="text-xs text-w5">no app do seu banco</p>
                </div>

                <div className="flex w-full flex-col gap-2">
                  <button
                    type="button"
                    onClick={copyPixKey}
                    className="rounded-xl border border-pp3/40 bg-p1/60 px-3 py-2.5 text-xs font-bold text-w1 transition-colors hover:border-g3 hover:text-g3"
                  >
                    {copied === "key" ? "Chave copiada ✓" : "Copiar chave"}
                  </button>
                </div>

                <p className="text-center text-[11px] leading-tight text-w5">
                  {PIX_NAME}
                </p>
              </div>

              {/* Formulário */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label
                    className="mb-1.5 block text-sm text-w3"
                    htmlFor="nome"
                  >
                    Nome completo
                  </label>
                  <input
                    id="nome"
                    className="field w-full rounded-xl px-4 py-3"
                    placeholder="Seu nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label
                    className="mb-1.5 block text-sm text-w3"
                    htmlFor="telefone"
                  >
                    Telefone
                  </label>
                  <input
                    id="telefone"
                    className="field w-full rounded-xl px-4 py-3"
                    placeholder="(83) 99999-9999"
                    inputMode="numeric"
                    value={telefone}
                    onChange={(e) => setTelefone(maskPhone(e.target.value))}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm text-w3">
                    Número da rifa
                  </label>
                  <input
                    className="field w-full rounded-xl px-4 py-3 opacity-80"
                    value={selected}
                    readOnly
                  />
                </div>

                <div>
                  <label
                    className="mb-1.5 block text-sm text-w3"
                    htmlFor="comprovante"
                  >
                    Comprovante de pagamento{" "}
                    <span className="text-g3">*</span>
                  </label>
                  <input
                    id="comprovante"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                    onChange={handleReceiptChange}
                    required
                    className="field w-full cursor-pointer rounded-xl px-4 py-3 text-sm text-w2 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-g2/20 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-g3"
                  />
                  {receipt && (
                    <p className="mt-1.5 text-xs text-g3">
                      {receipt.name} · {formatBytes(receipt.size)}
                    </p>
                  )}
                  {receiptError && (
                    <p className="mt-1.5 text-xs text-red-400">
                      {receiptError}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!valid || submitting}
                  className="btn-primary mt-1 rounded-xl py-3.5 font-bold"
                >
                  {submitting ? "Enviando..." : "Confirmar minha reserva 🎉"}
                </button>
                {submitError && (
                  <p className="text-center text-xs text-red-400">
                    {submitError}
                  </p>
                )}
                <p className="text-center text-xs text-w5">
                  Anexe o comprovante do Pix de R$ 5,00 para confirmar sua
                  reserva.
                </p>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="overlay fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-p0/90 p-4 backdrop-blur-sm">
          <div className="pointer-events-none absolute inset-0">
            {confetti.map((c) => (
              <span
                key={c.id}
                className="confetti"
                style={{
                  left: `${c.left}%`,
                  background: c.color,
                  animationDelay: `${c.delay}s`,
                  animationDuration: `${c.duration}s`,
                }}
              />
            ))}
          </div>

          <div className="success-pop card relative w-full max-w-md rounded-3xl p-8 text-center shadow-2xl">
            <svg
              viewBox="0 0 66 66"
              className="mx-auto h-20 w-20"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle
                className="check-circle"
                cx="33"
                cy="33"
                r="26"
                stroke="#04d361"
                strokeWidth="4"
              />
              <path
                className="check-mark"
                d="M20 34 L29 43 L47 24"
                stroke="#00ff73"
                strokeWidth="5"
              />
            </svg>

            <h2 className="rise mt-5 text-2xl font-extrabold text-g3">
              Obrigada por contribuir com a Knex! 💚
            </h2>
            <p className="rise mt-3 text-w2">
              Seu número <strong className="text-w0">{selected}</strong> foi
              reservado com sucesso.
            </p>
            <p className="rise mt-2 text-sm text-w4">
              Recebemos seu comprovante de <strong>R$ 5,00</strong> e ele será
              conferido pela organização. 🍀
            </p>
            <button
              onClick={closeSuccess}
              className="btn-primary rise mt-6 w-full rounded-xl py-3.5 font-bold"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
