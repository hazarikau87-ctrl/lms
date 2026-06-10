import { useState, useEffect, CSSProperties } from "react";
import { supabase } from "../lib/supabase"; // Use your existing shared supabase client instantiation

type PaymentMethod = "cash" | "upi" | "card_external";

interface MethodMeta {
  label: string;
  icon: string;
  refLabel: string | null;
}

interface BillingModuleProps {
  appointmentId: number; // bigint from database
  labId: string;         // uuid from database
  selectedTests: string[]; // Pass selected test array down to cross-verify prices
  availableTestsMeta: any[] | null; // labInfo.available_tests jsonb metadata array
  onPaymentSuccess?: (payment: Record<string, unknown>) => void;
  themeColor?: string;
  isInline?: boolean;
}

const fmt = (n: number): string =>
  "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0 });

const METHOD_META: Record<PaymentMethod, MethodMeta> = {
  cash:          { label: "Cash",       icon: "💵", refLabel: null },
  upi:           { label: "UPI",        icon: "📲", refLabel: "UPI Transaction ID / UTR (optional)" },
  card_external: { label: "Card / POS", icon: "🖥️",  refLabel: "POS Slip/Approval Reference (optional)" },
};

export default function BillingModule({
  appointmentId,
  labId,
  selectedTests = [],
  availableTestsMeta = [],
  onPaymentSuccess,
  themeColor = "#4f46e5",
  isInline = false,
}: BillingModuleProps) {
  // Financial calculation tracking states
  const [advancePaid, setAdvancePaid] = useState<number>(0);
  const [loading, setLoading]         = useState<boolean>(true);
  const [fetchError, setFetchError]   = useState<string | null>(null);

  // Form submission tracking states
  const [method, setMethod]               = useState<PaymentMethod>("cash");
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [submitting, setSubmitting]       = useState<boolean>(false);
  const [submitError, setSubmitError]     = useState<string | null>(null);
  const [settled, setSettled]             = useState<boolean>(false);

  // ── Calculate total bill using jsonb data array items ──
  const totalBill = (availableTestsMeta || [])
    .filter((t: any) => {
      const name = t?.name || t?.test_name || "";
      return selectedTests.includes(name);
    })
    .reduce((sum: number, t: any) => sum + Number(t?.price || 0), 0);

  useEffect(() => {
    if (!appointmentId || !labId) return;

    async function checkPriorLedgers() {
      setLoading(true);
      setFetchError(null);
      try {
        const { data, error } = await supabase
          .from("payments")
          .select("amount_paid")
          .eq("appointment_id", appointmentId)
          .eq("lab_id", labId);

        if (error) throw error;

        const totalPaid = (data || []).reduce(
          (sum, p) => sum + Number(p.amount_paid || 0),
          0
        );
        setAdvancePaid(totalPaid);
      } catch (err: any) {
        console.error("Billing ledger error:", err);
        setFetchError("Failed to fetch historical payments ledger row.");
      } finally {
        setLoading(false);
      }
    }

    checkPriorLedgers();
  }, [appointmentId, labId]);

  const netDue = Math.max(totalBill - advancePaid, 0);

  async function handleSettlePayment() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { data, error } = await supabase
        .from("payments")
        .insert([
          {
            lab_id: labId, // uuid
            appointment_id: appointmentId, // bigint
            amount_paid: netDue, // numeric
            payment_method: method, // USER-DEFINED enum match
            transaction_ref: method !== "cash" && transactionRef.trim() ? transactionRef.trim() : null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setSettled(true);
      if (onPaymentSuccess) onPaymentSuccess(data);
    } catch (err: any) {
      setSubmitError(err.message || "Failed to finalize transactions logging mapping entry.");
    } finally {
      setSubmitting(false);
    }
  }

  const containerStyle = isInline ? s.inlineWrapper : s.card;

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={s.loadingRow}>
          <span style={{ ...s.spinner, borderTopColor: themeColor }} />
          <span style={s.muted}>Loading dynamic calculations ledger…</span>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div style={containerStyle}>
        <div style={{ ...s.alert, ...s.alertDanger }}>{fetchError}</div>
      </div>
    );
  }

  if (settled) {
    return (
      <div style={{ ...containerStyle, textAlign: "center", padding: "1.5rem 0" }}>
        <div style={s.successIcon}>✓</div>
        <h3 style={s.h3}>Payment Securely Processed</h3>
        <p style={s.muted}>
          Amount of {fmt(netDue)} received via {METHOD_META[method].label}
        </p>
      </div>
    );
  }

  const meta = METHOD_META[method];

  return (
    <div style={containerStyle}>
      <div style={s.metricGrid}>
        <div style={s.metric}>
          <div style={s.metricLabel}>Gross Subtotal</div>
          <div style={s.metricValue}>{fmt(totalBill)}</div>
        </div>
        <div style={s.metric}>
          <div style={s.metricLabel}>Balance Pending</div>
          <div style={{ ...s.metricValue, color: netDue > 0 ? "#b91c1c" : "#15803d" }}>{fmt(netDue)}</div>
        </div>
      </div>

      <div style={s.sectionLabel}>Choose Payment Mode</div>
      <div style={s.methodGrid}>
        {(Object.entries(METHOD_META) as [PaymentMethod, MethodMeta][]).map(([key, m]) => {
          const isActive = method === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => { setMethod(key); setTransactionRef(""); }}
              style={{ 
                ...s.methodBtn, 
                ...(isActive ? {
                  border: `1.5px solid ${themeColor}`,
                  background: `${themeColor}0d`,
                  color: themeColor,
                } : {}) 
              }}
            >
              <span style={{ fontSize: 20 }}>{m.icon}</span>
              <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400 }}>
                {m.label}
              </span>
            </button>
          );
        })}
      </div>

      {meta.refLabel && (
        <div style={s.refWrap}>
          <label style={s.refLabel}>{meta.refLabel}</label>
          <input
            type="text"
            value={transactionRef}
            onChange={(e) => setTransactionRef(e.target.value)}
            placeholder={method === "upi" ? "Enter UPI UTR Reference Number" : "Enter Approval Code"}
            style={s.input}
          />
        </div>
      )}

      {submitError && (
        <div style={{ ...s.alert, ...s.alertDanger }}>{submitError}</div>
      )}

      <div className="mt-6 pt-2 flex justify-end">
        <button
          type="button"
          onClick={handleSettlePayment}
          disabled={submitting || netDue <= 0}
          className="w-full sm:w-auto px-6 py-3 text-xs font-bold text-white rounded-xl shadow transition-all duration-150 active:scale-95 disabled:opacity-40"
          style={{ backgroundColor: themeColor }}
        >
          {submitting ? "Writing ledger item..." : `Finalize & Clear Balance (${fmt(netDue)})`}
        </button>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  card: { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "1.5rem", maxWidth: 520 },
  inlineWrapper: { width: "100%" },
  h3: { fontSize: 16, fontWeight: 600, margin: "0 0 4px", color: "#1f2937" },
  muted: { fontSize: 13, color: "#4b5563", margin: 0 },
  metricGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: "1rem" },
  metric: { background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 10, padding: "12px 14px" },
  metricLabel: { fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.02em" },
  metricValue: { fontSize: 20, fontWeight: 700, color: "#111827", marginTop: 2 },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, marginTop: "1.25rem" },
  methodGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: "1rem" },
  methodBtn: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 8px", border: "1px solid #e5e7eb", borderRadius: 10, cursor: "pointer", background: "#fff", color: "#374151" },
  refWrap: { marginBottom: "1rem" },
  refLabel: { fontSize: 12, color: "#4b5563", display: "block", marginBottom: 6, fontWeight: 500 },
  input: { width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, color: "#111827", background: "#fff", outline: "none" },
  alert: { padding: "10px 12px", borderRadius: 8, fontSize: 13, marginBottom: 10 },
  alertDanger: { background: "#fef2f2", color: "#991b1b", border: "1px solid #fee2e2" },
  loadingRow: { display: "flex", alignItems: "center", gap: 10, padding: "1.5rem 0", justifyContent: "center" },
  spinner: { width: 18, height: 18, border: "2px solid #e5e7eb", borderRadius: "50%", display: "inline-block", animation: "spin 0.6s linear infinite" },
  successIcon: { fontSize: 32, color: "#16a34a", marginBottom: "0.5rem", display: "block" },
};
