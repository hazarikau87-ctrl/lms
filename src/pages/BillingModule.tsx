import { useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { supabase } from "../lib/supabase";

type PaymentMethod = "cash" | "upi" | "card_external";

interface BillingModuleProps {
  appointmentId: number;
  labId: string;
  selectedTests: string[];
  availableTestsMeta: any[] | null;
  /**
   * Callback fired immediately when a payment is processed successfully.
   * Returns the transaction data along with the updated remaining balance to determine split-pay UI states.
   */
  onPaymentSuccess?: (payment: Record<string, unknown> & { balanceRemaining: number }) => void;
  themeColor?: string;
}

const fmt = (n: number) =>
  "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const METHOD_LABELS: Record<PaymentMethod, { label: string; icon: string }> = {
  cash: { label: "Cash", icon: "💵" },
  upi: { label: "UPI", icon: "📲" },
  card_external: { label: "Card", icon: "💳" },
};

const STATUS_CONFIG = {
  UNPAID: {
    bg: "#FEF2F2",
    border: "#FECACA",
    text: "#B91C1C",
    dot: "#EF4444",
    label: "Unpaid",
  },
  "PARTIALLY PAID": {
    bg: "#FFFBEB",
    border: "#FDE68A",
    text: "#92400E",
    dot: "#F59E0B",
    label: "Partially Paid",
  },
  PAID: {
    bg: "#F0FDF4",
    border: "#BBF7D0",
    text: "#14532D",
    dot: "#22C55E",
    label: "Paid in Full",
  },
};

export default function BillingModule({
  appointmentId,
  labId,
  selectedTests = [],
  availableTestsMeta = [],
  onPaymentSuccess,
  themeColor = "#4f46e5",
}: BillingModuleProps) {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [notes, setNotes] = useState("");
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [upiQrData, setUpiQrData] = useState<{ upiString: string; labName: string } | null>(null);
  const [loadingUpi, setLoadingUpi] = useState(false);

  const totalBill = (availableTestsMeta || [])
    .filter((t: any) => selectedTests.includes(t?.name || t?.test_name || ""))
    .reduce((s: number, t: any) => s + Number(t?.price || 0), 0);

  const collected = useMemo(
    () => payments.reduce((s, p) => s + Number(p.amount_paid || 0), 0),
    [payments]
  );

  const balance = Math.max(totalBill - collected, 0);

  const status: keyof typeof STATUS_CONFIG =
    collected <= 0 ? "UNPAID" : collected < totalBill ? "PARTIALLY PAID" : "PAID";

  const statusCfg = STATUS_CONFIG[status];

  useEffect(() => {
    load();
  }, [appointmentId, labId]);

  async function load() {
    setLoading(true);
    try {
      const { data: pay, error: payError } = await supabase
        .from("payments")
        .select("*")
        .eq("appointment_id", appointmentId)
        .eq("lab_id", labId)
        .order("created_at", { ascending: false });

      if (payError) throw payError;
      setPayments(pay || []);
    } catch (err: any) {
      setError("Failed to load payment history: " + err.message);
    }
    setLoading(false);
  }

  const amountNumber = Number(amount || 0);

  // Fetch UPI QR from Edge Function (never exposes raw upi_id)
  async function generateUpiQr() {
    if (method !== "upi" || amountNumber <= 0) return;

    setLoadingUpi(true);
    setError("");

    try {
      const response = await supabase.functions.invoke("generate-upi-string", {
        body: {
          appointmentId,
          labId,
          amount: amountNumber,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setUpiQrData(response.data);
    } catch (err: any) {
      setError("Could not generate UPI QR: " + err.message);
      setUpiQrData(null);
    }

    setLoadingUpi(false);
  }

  // Regenerate QR when amount or method changes
  useEffect(() => {
    if (method === "upi" && amountNumber > 0) {
      generateUpiQr();
    } else {
      setUpiQrData(null);
    }
  }, [method, amountNumber]);

  // Verify payment server-side before recording
  async function collectPayment() {
    setError("");

    if (amountNumber <= 0) return setError("Enter a valid amount.");
    if (amountNumber > balance) return setError("Amount exceeds the pending balance.");
    if (method === "upi" && !verified)
      return setError("Confirm that the UPI payment was received before recording.");

    setSaving(true);

    try {
      // Calculated upcoming balance post-deduction locally for programmatic evaluation
      const nextBalanceRemaining = Math.max(balance - amountNumber, 0);

      // Call Edge Function to verify and insert payment
      const response = await supabase.functions.invoke("verify-payment", {
        body: {
          appointmentId,
          labId,
          amount: amountNumber,
          paymentMethod: method,
          transactionRef: transactionRef || null,
          notes: notes || null, // Included notes tracking explicitly for accounting transparency
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Clear local entry state values to make room for subsequent split amounts
      setAmount("");
      setTransactionRef("");
      setNotes("");
      setVerified(false);
      setUpiQrData(null);

      await load();

      // Dispatch event to parent module containing explicit context on split payment remainders
      onPaymentSuccess?.({
        ...(response.data || {}),
        balanceRemaining: nextBalanceRemaining,
      });
    } catch (err: any) {
      setError(err.message);
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <div style={styles.shell}>
        <div style={styles.skeletonWrap}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={styles.skeletonLine} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.shell}>
      <div
        style={{
          ...styles.statusBanner,
          background: statusCfg.bg,
          border: `1px solid ${statusCfg.border}`,
        }}
      >
        <span style={{ ...styles.statusDot, background: statusCfg.dot }} />
        <span style={{ ...styles.statusText, color: statusCfg.text }}>
          {statusCfg.label}
        </span>
        {status !== "PAID" && (
          <span style={{ ...styles.statusBalance, color: statusCfg.text }}>
            {fmt(balance)} outstanding
          </span>
        )}
      </div>

      <div style={styles.cardGrid}>
        <SummaryCard label="Total Bill" value={fmt(totalBill)} accent="#64748B" />
        <SummaryCard
          label="Collected"
          value={fmt(collected)}
          accent="#10B981"
          highlight={collected > 0}
        />
        <SummaryCard
          label="Balance Due"
          value={fmt(balance)}
          accent={balance > 0 ? "#EF4444" : "#10B981"}
          highlight={balance > 0}
        />
      </div>

      <hr style={styles.divider} />

      {balance > 0 && (
        <section style={styles.section}>
          <h3 style={styles.sectionHeading}>Collect Payment</h3>

          <label style={styles.fieldLabel}>Amount</label>
          <div style={styles.amountRow}>
            <span style={styles.currencyPrefix}>₹</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              type="number"
              min={0}
              max={balance}
              style={styles.amountInput}
            />
            <button
              style={{
                ...styles.quickFill,
                borderColor: themeColor,
                color: themeColor,
              }}
              onClick={() => setAmount(String(balance))}
            >
              Full balance
            </button>
          </div>

          <label style={styles.fieldLabel}>Payment method</label>
          <div style={styles.methodRow}>
            {(["cash", "upi", "card_external"] as PaymentMethod[]).map((m) => {
              const active = method === m;
              return (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  style={{
                    ...styles.methodBtn,
                    ...(active
                      ? {
                          background: themeColor,
                          color: "#fff",
                          borderColor: themeColor,
                          boxShadow: `0 2px 8px ${themeColor}40`,
                        }
                      : {}),
                  }}
                >
                  <span style={styles.methodIcon}>
                    {METHOD_LABELS[m].icon}
                  </span>
                  {METHOD_LABELS[m].label}
                </button>
              );
            })}
          </div>

          {method === "upi" && amountNumber > 0 && (
            <div style={styles.upiCard}>
              {loadingUpi ? (
                <div style={styles.upiLoading}>Generating QR...</div>
              ) : upiQrData ? (
                <>
                  <div style={styles.upiQrWrap}>
                    <QRCode value={upiQrData.upiString} size={160} />
                  </div>
                  <div style={styles.upiInfo}>
                    <div style={styles.upiAmount}>{fmt(amountNumber)}</div>
                    <div style={styles.upiLabName}>{upiQrData.labName}</div>
                    <div style={styles.upiHint}>Scan with any UPI app to pay</div>
                  </div>
                  <label style={styles.verifyRow}>
                    <input
                      type="checkbox"
                      checked={verified}
                      onChange={(e) => setVerified(e.target.checked)}
                      style={styles.checkbox}
                    />
                    <span style={styles.verifyLabel}>
                      Payment received and verified
                    </span>
                  </label>
                </>
              ) : (
                <div style={styles.upiError}>Could not load UPI details</div>
              )}
            </div>
          )}

          <label style={styles.fieldLabel}>
            Transaction reference{" "}
            <span style={{ color: "#94A3B8", fontWeight: 400 }}>
              (optional)
            </span>
          </label>
          <input
            value={transactionRef}
            onChange={(e) => setTransactionRef(e.target.value)}
            placeholder="UTR / Ref no."
            style={styles.input}
          />

          <label style={styles.fieldLabel}>
            Notes{" "}
            <span style={{ color: "#94A3B8", fontWeight: 400 }}>
              (optional)
            </span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              amountNumber > 0 && amountNumber < balance
                ? `e.g., Split payment: part ${payments.length + 1} paid via ${METHOD_LABELS[method].label}`
                : "Any remarks for this transaction"
            }
            rows={2}
            style={{ ...styles.input, resize: "vertical" }}
          />

          {error && (
            <div style={styles.errorBox}>
              <span style={styles.errorIcon}>⚠</span>
              {error}
            </div>
          )}

          <button
            onClick={collectPayment}
            disabled={saving}
            style={{
              ...styles.primaryBtn,
              background: saving ? "#94A3B8" : themeColor,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 14,
                    border: "2px solid rgba(255,255,255,0.4)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                Saving…
              </span>
            ) : balance > amountNumber && amountNumber > 0 ? (
              `Record Partial Payment (${fmt(amountNumber)})`
            ) : (
              "Record Payment"
            )}
          </button>
        </section>
      )}

      {balance > 0 && <hr style={styles.divider} />}

      <section style={styles.section}>
        <h3 style={styles.sectionHeading}>Payment History</h3>

        {payments.length === 0 ? (
          <p style={styles.emptyState}>No payments recorded yet.</p>
        ) : (
          <div style={styles.historyList}>
            {payments.map((p, idx) => (
              <div key={p.id} style={styles.historyItem}>
                <div style={styles.historyTimeline}>
                  <div style={{ ...styles.historyDot, background: themeColor }} />
                  {idx < payments.length - 1 && <div style={styles.historyLine} />}
                </div>
                <div style={styles.historyContent}>
                  <div style={styles.historyTop}>
                    <span style={styles.historyAmount}>{fmt(p.amount_paid)}</span>
                    <span style={styles.historyMethod}>
                      {METHOD_LABELS[p.payment_method as PaymentMethod]?.icon}{" "}
                      {METHOD_LABELS[p.payment_method as PaymentMethod]?.label ||
                        p.payment_method}
                    </span>
                  </div>
                  {p.transaction_ref && (
                    <div style={styles.historyRef}>Ref: {p.transaction_ref}</div>
                  )}
                  {p.notes && (
                    <div style={styles.historyNotes}>{p.notes}</div>
                  )}
                  <div style={styles.historyDate}>
                    {new Date(p.created_at).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  highlight,
}: {
  label: string;
  value: string;
  accent: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderTop: `3px solid ${accent}`,
        padding: "16px 20px",
        ...(highlight ? { background: "#FAFAFA" } : {}),
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: -0.5, color: accent }}>
        {value}
      </div>
    </div>
  );
}

// ─── Styles
const BASE_FONT: React.CSSProperties = {
  fontFamily:
    "Inter, 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
};

const styles: Record<string, React.CSSProperties> = {
  shell: {
    ...BASE_FONT,
    background: "#FFFFFF",
    borderRadius: 16,
    border: "1px solid #E2E8F0",
    boxShadow: "0 1px 4px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)",
    overflow: "hidden",
    fontSize: 14,
    color: "#0F172A",
  },
  statusBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 20px",
    fontSize: 13,
    fontWeight: 500,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  },
  statusText: {
    fontWeight: 600,
    letterSpacing: 0.2,
  },
  statusBalance: {
    marginLeft: "auto",
    fontVariantNumeric: "tabular-nums",
    fontSize: 13,
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 1,
    background: "#E2E8F0",
    margin: 0,
  },
  divider: {
    margin: 0,
    border: "none",
    borderTop: "1px solid #F1F5F9",
  },
  section: {
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  sectionHeading: {
    ...BASE_FONT,
    fontSize: 13,
    fontWeight: 600,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    margin: "0 0 4px",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: "#374151",
    marginTop: 4,
    display: "block",
  },
  input: {
    ...BASE_FONT,
    width: "100%",
    border: "1px solid #E2E8F0",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 14,
    color: "#0F172A",
    background: "#F8FAFC",
    outline: "none",
    boxSizing: "border-box",
  },
  amountRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: 600,
    color: "#64748B",
    flexShrink: 0,
  },
  amountInput: {
    ...BASE_FONT,
    flex: 1,
    border: "1px solid #E2E8F0",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 18,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    color: "#0F172A",
    background: "#F8FAFC",
    outline: "none",
    boxSizing: "border-box" as const,
  },
  quickFill: {
    ...BASE_FONT,
    flexShrink: 0,
    border: "1.5px solid",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 500,
    background: "transparent",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  methodRow: {
    display: "flex",
    gap: 8,
  },
  methodBtn: {
    ...BASE_FONT,
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    border: "1.5px solid #E2E8F0",
    borderRadius: 10,
    padding: "10px 8px",
    fontSize: 13,
    fontWeight: 500,
    color: "#374151",
    background: "#F8FAFC",
    cursor: "pointer",
  },
  methodIcon: {
    fontSize: 16,
  },
  upiCard: {
    border: "1px solid #E2E8F0",
    borderRadius: 12,
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    background: "#FAFAFA",
  },
  upiQrWrap: {
    padding: 12,
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #E2E8F0",
    display: "inline-flex",
  },
  upiLoading: {
    color: "#94A3B8",
    fontSize: 13,
  },
  upiError: {
    color: "#EF4444",
    fontSize: 13,
  },
  upiInfo: {
    textAlign: "center" as const,
  },
  upiAmount: {
    fontSize: 22,
    fontWeight: 800,
    color: "#0F172A",
    fontVariantNumeric: "tabular-nums",
  },
  upiLabName: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  upiHint: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 4,
  },
  verifyRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    padding: "8px 14px",
    borderRadius: 8,
    background: "#F0FDF4",
    border: "1px solid #BBF7D0",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  checkbox: {
    width: 16,
    height: 16,
    accentColor: "#10B981",
    cursor: "pointer",
    flexShrink: 0,
  },
  verifyLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: "#14532D",
  },
  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#FEF2F2",
    border: "1px solid #FECACA",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "#B91C1C",
    fontWeight: 500,
  },
  errorIcon: {
    fontSize: 15,
    flexShrink: 0,
  },
  primaryBtn: {
    ...BASE_FONT,
    width: "100%",
    border: "none",
    borderRadius: 10,
    padding: "13px",
    fontSize: 14,
    fontWeight: 600,
    color: "#fff",
    marginTop: 4,
    letterSpacing: 0.2,
  },
  historyList: {
    display: "flex",
    flexDirection: "column",
  },
  historyItem: {
    display: "flex",
    gap: 14,
    paddingBottom: 16,
  },
  historyTimeline: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flexShrink: 0,
    paddingTop: 3,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    flexShrink: 0,
  },
  historyLine: {
    flex: 1,
    width: 2,
    background: "#E2E8F0",
    marginTop: 4,
    minHeight: 16,
  },
  historyContent: {
    flex: 1,
    paddingBottom: 4,
  },
  historyTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  historyAmount: {
    fontSize: 16,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    color: "#0F172A",
  },
  historyMethod: {
    fontSize: 12,
    fontWeight: 500,
    color: "#64748B",
    background: "#F1F5F9",
    borderRadius: 6,
    padding: "2px 8px",
  },
  historyRef: {
    fontSize: 12,
    color: "#64748B",
    fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace",
  },
  historyNotes: {
    fontSize: 12,
    color: "#94A3B8",
    fontStyle: "italic",
    marginTop: 2,
  },
  historyDate: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 4,
  },
  skeletonWrap: {
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  skeletonLine: {
    height: 20,
    background: "linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)",
    borderRadius: 6,
    backgroundSize: "200% 100%",
    animation: "shimmer 1.4s infinite",
  },
  emptyState: {
    fontSize: 13,
    color: "#94A3B8",
    margin: 0,
    padding: "12px 0",
  },
};

if (typeof document !== "undefined") {
  const styleId = "billing-module-animations";
  if (!document.getElementById(styleId)) {
    const el = document.createElement("style");
    el.id = styleId;
    el.textContent = `
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    `;
    document.head.appendChild(el);
  }
}