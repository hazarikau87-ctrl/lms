import { useEffect, useMemo, useState } from "react";
import { 
  TrendingUp, 
  DollarSign, 
  Smartphone, 
  CreditCard, 
  Calendar, 
  RefreshCw, 
  Search,
  Filter,
  ArrowUpRight,
  RotateCcw
} from "lucide-react";
import { supabase } from "../lib/supabase";

type PaymentMethod = "cash" | "upi" | "card_external" | "all" | "refunded";

interface PaymentRecord {
  id: string | number;
  appointment_id: number;
  booking_id: string; 
  lab_id: string;
  amount_paid: number;
  payment_method: "cash" | "upi" | "card_external";
  transaction_ref?: string;
  notes?: string;
  created_at: string;
  is_refunded?: boolean;
  refunded_amount?: number;
  refund_method?: "upi" | "cash" | "bank_transfer";
}

const fmt = (n: number) =>
  "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const METHOD_DETAILS = {
  cash: { label: "Cash", icon: DollarSign, color: "#10B981", bg: "#F0FDF4" },
  upi: { label: "UPI", icon: Smartphone, color: "#8B5CF6", bg: "#F5F3FF" },
  card_external: { label: "Card", icon: CreditCard, color: "#3B82F6", bg: "#EFF6FF" },
};

const getTodayString = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

export default function RevenueDashboard({ labId }: { labId: string }) {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [error, setError] = useState("");
  
  // Filters
  const [methodFilter, setMethodFilter] = useState<PaymentMethod>("all");
  const [startDate, setStartDate] = useState(getTodayString());
  const [endDate, setEndDate] = useState(getTodayString());
  const [searchQuery, setSearchQuery] = useState("");

  // Refund Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [refundType, setRefundType] = useState<"full" | "custom">("full");
  const [customAmount, setCustomAmount] = useState("");
  const [refundThrough, setRefundThrough] = useState<"upi" | "cash" | "bank_transfer">("upi");

  useEffect(() => {
    if (labId) {
      loadRevenueData();
    }
  }, [labId]);

  async function loadRevenueData() {
    setLoading(true);
    setError("");
    try {
      const { data, error: payError } = await supabase
        .from("payments")
        .select(`
          *,
          appointments (
            booking_id
          )
        `)
        .eq("lab_id", labId)
        .order("created_at", { ascending: false });

      if (payError) throw payError;

      const formattedData: PaymentRecord[] = (data || []).map((item: any) => {
        const appointmentObj = Array.isArray(item.appointments) 
          ? item.appointments[0] 
          : item.appointments;

        return {
          ...item,
          booking_id: appointmentObj?.booking_id || `N/A (Appt #${item.appointment_id})`
        };
      });

      setPayments(formattedData);
    } catch (err: any) {
      setError("Failed to fetch operational metrics: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleProcessRefund() {
    if (!selectedPayment) return;

    const finalRefundAmount = refundType === "full" 
      ? selectedPayment.amount_paid 
      : Number(customAmount);

    if (isNaN(finalRefundAmount) || finalRefundAmount <= 0 || finalRefundAmount > selectedPayment.amount_paid) {
      alert("Please enter a valid refund amount not exceeding the paid volume.");
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from("payments")
        .update({
          is_refunded: true,
          refunded_amount: finalRefundAmount,
          refund_method: refundThrough
        })
        .eq("id", selectedPayment.id);

      if (updateError) throw updateError;

      setPayments(prev => prev.map(p => {
        if (p.id === selectedPayment.id) {
          return {
            ...p,
            is_refunded: true,
            refunded_amount: finalRefundAmount,
            refund_method: refundThrough
          };
        }
        return p;
      }));

      closeRefundModal();
    } catch (err: any) {
      alert("Could not process refund status: " + err.message);
    }
  }

  const openRefundModal = (payment: PaymentRecord) => {
    setSelectedPayment(payment);
    setRefundType("full");
    setCustomAmount("");
    setRefundThrough("upi");
    setIsModalOpen(true);
  };

  const closeRefundModal = () => {
    setIsModalOpen(false);
    setSelectedPayment(null);
  };

  // Pure filtering logic
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (methodFilter === "refunded") {
        if (!p.is_refunded) return false;
      } else if (methodFilter !== "all" && p.payment_method !== methodFilter) {
        return false;
      }

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (new Date(p.created_at) < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(p.created_at) > end) return false;
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesRef = p.transaction_ref?.toLowerCase().includes(query);
        const matchesBooking = p.booking_id?.toLowerCase().includes(query);
        const matchesNotes = p.notes?.toLowerCase().includes(query);
        if (!matchesRef && !matchesBooking && !matchesNotes) return false;
      }

      return true;
    });
  }, [payments, methodFilter, startDate, endDate, searchQuery]);

  // Dynamic Aggregate Metrics Layout Handler
  const metrics = useMemo(() => {
    let total = 0;
    let cash = 0;
    let upi = 0;
    let card = 0;

    filteredPayments.forEach((p) => {
      if (methodFilter === "refunded") {
        // When showing explicitly refunded records, compile total capital lost to refunds
        const refundAmt = p.refunded_amount || 0;
        total += refundAmt;
        if (p.payment_method === "cash") cash += refundAmt;
        if (p.payment_method === "upi") upi += refundAmt;
        if (p.payment_method === "card_external") card += refundAmt;
      } else {
        // Standard net operational calculation mode
        const activeRefund = p.is_refunded ? (p.refunded_amount || 0) : 0;
        const netAmount = Number(p.amount_paid || 0) - activeRefund;
        
        total += netAmount;
        if (p.payment_method === "cash") cash += netAmount;
        if (p.payment_method === "upi") upi += netAmount;
        if (p.payment_method === "card_external") card += netAmount;
      }
    });

    return { total, cash, upi, card };
  }, [filteredPayments, methodFilter]);

  const clearFilters = () => {
    setMethodFilter("all");
    setStartDate(getTodayString());
    setEndDate(getTodayString());
    setSearchQuery("");
  };

  if (loading) {
    return (
      <div style={styles.dashboardShell}>
        <div style={styles.loaderContainer}>
          <RefreshCw size={24} style={styles.spinningIcon} />
          <p style={{ color: "#64748B", fontWeight: 500 }}>Analyzing financial ledgers...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.dashboardShell}>
      {/* Upper Navigation Row */}
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>Revenue Analytics</h1>
          <p style={styles.subtitle}>Overview of transactions, dynamic values, and breakdown variables</p>
        </div>
        <button onClick={loadRevenueData} style={styles.refreshBtn}>
          <RefreshCw size={16} /> Sync Data
        </button>
      </div>

      {error && (
        <div style={styles.errorAlert}>
          <span>⚠</span> {error}
        </div>
      )}

      {/* Dynamic Summary Cards */}
      <div style={styles.metricsGrid}>
        <div style={{ ...styles.metricCard, borderTop: methodFilter === "refunded" ? "4px solid #EF4444" : "4px solid #4F46E5" }}>
          <div style={styles.metricHeader}>
            <span style={styles.metricLabel}>{methodFilter === "refunded" ? "Total Refund Outflows" : "Total Revenue"}</span>
            <div style={{ ...styles.iconWrapper, background: methodFilter === "refunded" ? "#FEF2F2" : "#EEF2FF", color: methodFilter === "refunded" ? "#EF4444" : "#4F46E5" }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div style={styles.metricValue}>{fmt(metrics.total)}</div>
          <div style={styles.metricSubtext}>{methodFilter === "refunded" ? "Sum of total processed refunds" : "Aggregate net processed flow"}</div>
        </div>

        <div style={{ ...styles.metricCard, borderTop: `4px solid ${METHOD_DETAILS.cash.color}` }}>
          <div style={styles.metricHeader}>
            <span style={styles.metricLabel}>{methodFilter === "refunded" ? "Cash Refunded" : "Cash Payments"}</span>
            <div style={{ ...styles.iconWrapper, background: METHOD_DETAILS.cash.bg, color: METHOD_DETAILS.cash.color }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div style={styles.metricValue}>{fmt(metrics.cash)}</div>
          <div style={styles.metricSubtext}>{methodFilter === "refunded" ? "Cash drawer deductions" : "Physical cash register balance"}</div>
        </div>

        <div style={{ ...styles.metricCard, borderTop: `4px solid ${METHOD_DETAILS.upi.color}` }}>
          <div style={styles.metricHeader}>
            <span style={styles.metricLabel}>{methodFilter === "refunded" ? "UPI Refunded" : "UPI Volume"}</span>
            <div style={{ ...styles.iconWrapper, background: METHOD_DETAILS.upi.bg, color: METHOD_DETAILS.upi.color }}>
              <Smartphone size={20} />
            </div>
          </div>
          <div style={styles.metricValue}>{fmt(metrics.upi)}</div>
          <div style={styles.metricSubtext}>{methodFilter === "refunded" ? "Digital reversed volume" : "Direct instant bank settlements"}</div>
        </div>

        <div style={{ ...styles.metricCard, borderTop: `4px solid ${METHOD_DETAILS.card_external.color}` }}>
          <div style={styles.metricHeader}>
            <span style={styles.metricLabel}>{methodFilter === "refunded" ? "Card Reversals" : "Card Terminals"}</span>
            <div style={{ ...styles.iconWrapper, background: METHOD_DETAILS.card_external.bg, color: METHOD_DETAILS.card_external.color }}>
              <CreditCard size={20} />
            </div>
          </div>
          <div style={styles.metricValue}>{fmt(metrics.card)}</div>
          <div style={styles.metricSubtext}>{methodFilter === "refunded" ? "External terminal rollbacks" : "External card merchant volume"}</div>
        </div>
      </div>

      {/* Control Filter Bar */}
      <div style={styles.filterBar}>
        <div style={styles.searchContainer}>
          <Search size={18} style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search Reference, Booking ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div style={styles.filtersGroup}>
          <div style={styles.filterField}>
            <Filter size={14} style={{ color: "#64748B" }} />
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value as PaymentMethod)}
              style={styles.selectInput}
            >
              <option value="all">All Channels</option>
              <option value="cash">Cash Ledger Only</option>
              <option value="upi">UPI Dynamic Node</option>
              <option value="card_external">Card POS Terminal</option>
              <option value="refunded">Refunded Entries Only</option>
            </select>
          </div>

          <div style={styles.dateFieldGroup}>
            <Calendar size={14} style={{ color: "#64748B" }} />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={styles.dateInput}
            />
            <span style={{ color: "#94A3B8" }}>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={styles.dateInput}
            />
          </div>

          {(startDate !== getTodayString() || endDate !== getTodayString() || methodFilter !== "all" || searchQuery) && (
            <button onClick={clearFilters} style={styles.clearFiltersBtn}>
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Transaction Table Matrix */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeaderSection}>
          <h2 style={styles.tableTitle}>Ledger Entries Matrix</h2>
          <span style={styles.tableBadge}>{filteredPayments.length} transactions match</span>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thRow}>
                <th style={styles.th}>Timestamp</th>
                <th style={styles.th}>Booking ID</th>
                <th style={styles.th}>Channel Method</th>
                <th style={styles.th}>Reference Identification</th>
                <th style={styles.th}>Notes / Remarks</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Flow Volume</th>
                <th style={{ ...styles.th, textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} style={styles.emptyStateTd}>
                    No specific records found aligning with the active telemetry criteria.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => {
                  const methodCfg = METHOD_DETAILS[p.payment_method] || {
                    label: p.payment_method,
                    icon: HelpCircle,
                    color: "#64748B",
                    bg: "#F1F5F9",
                  };
                  const IconComponent = methodCfg.icon;
                  
                  const rowStyle = p.is_refunded 
                    ? { ...styles.tr, backgroundColor: "#FEF2F2" } 
                    : styles.tr;

                  return (
                    <tr key={p.id} style={rowStyle}>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 500, color: "#0F172A" }}>
                          {new Date(p.created_at).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                          {new Date(p.created_at).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.idBadge}>{p.booking_id}</span>
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.statusBadge,
                            color: methodCfg.color,
                            backgroundColor: methodCfg.bg,
                          }}
                        >
                          <IconComponent size={12} style={{ marginRight: 4 }} />
                          {methodCfg.label}
                        </span>
                      </td>
                      <td style={{ ...styles.td, fontFamily: "monospace", fontSize: 13, color: "#475569" }}>
                        {p.transaction_ref ? p.transaction_ref : <span style={{ color: "#CBD5E1" }}>—</span>}
                      </td>
                      <td style={{ ...styles.td, color: "#64748B", fontSize: 13, fontStyle: p.notes ? "normal" : "italic" }}>
                        {p.notes ? p.notes : "No remarks configured"}
                      </td>
                      <td style={{ ...styles.td, textAlign: "right", fontWeight: 700, color: p.is_refunded ? "#DC2626" : "#0F172A", fontSize: 15 }}>
                        {p.is_refunded ? (
                          <div>
                            {/* FIXED: Replaced invalid style key 'blockRule' with standard valid CSS 'display: "block"' */}
                            <span style={{ fontSize: 12, fontWeight: 500, color: "#EF4444", display: "block", marginBottom: 2 }}>
                              (Refunded {fmt(p.refunded_amount || 0)})
                            </span>
                            <span style={{ textDecoration: "line-through", color: "#94A3B8", fontSize: 13 }}>
                              {fmt(p.amount_paid)}
                            </span>
                          </div>
                        ) : (
                          fmt(p.amount_paid)
                        )}
                      </td>
                      <td style={{ ...styles.td, textAlign: "center" }}>
                        {p.is_refunded ? (
                          <span style={styles.refundedLabelTag}>Refunded</span>
                        ) : (
                          <button onClick={() => openRefundModal(p)} style={styles.refundActionBtn}>
                            <RotateCcw size={12} /> Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dynamic Modal Window */}
      {isModalOpen && selectedPayment && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Initiate Action Ledger Refund</h3>
            <p style={styles.modalDescription}>
              Processing workflow for Booking Reference ID: <strong style={{ color: "#0F172A" }}>{selectedPayment.booking_id}</strong>
            </p>

            <div style={{ marginBottom: 18 }}>
              <label style={styles.modalLabel}>Refund Dimensions</label>
              <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                <label style={styles.radioLabel}>
                  <input 
                    type="radio" 
                    name="refundType" 
                    checked={refundType === "full"} 
                    onChange={() => setRefundType("full")} 
                  />
                  Full Refund ({fmt(selectedPayment.amount_paid)})
                </label>
                <label style={styles.radioLabel}>
                  <input 
                    type="radio" 
                    name="refundType" 
                    checked={refundType === "custom"} 
                    onChange={() => setRefundType("custom")} 
                  />
                  Custom Allocation
                </label>
              </div>
            </div>

            {refundType === "custom" && (
              <div style={{ marginBottom: 18 }}>
                <label style={styles.modalLabel}>Allocation Custom Value (₹)</label>
                <input 
                  type="number" 
                  max={selectedPayment.amount_paid}
                  placeholder="Enter explicit refund value flow"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  style={styles.modalTextInput}
                />
              </div>
            )}

            <div style={{ marginBottom: 24 }}>
              <label style={styles.modalLabel}>Refund Method Channel Path</label>
              <select 
                value={refundThrough} 
                onChange={(e) => setRefundThrough(e.target.value as any)}
                style={styles.modalSelectInput}
              >
                <option value="upi">UPI Operational Node</option>
                <option value="cash">Cash Ledger Settlement</option>
                <option value="bank_transfer">Direct Corporate Bank Transfer</option>
              </select>
            </div>

            <div style={styles.modalActionsRow}>
              <button onClick={closeRefundModal} style={styles.modalCancelBtn}>
                Abort Window
              </button>
              <button onClick={handleProcessRefund} style={styles.modalConfirmBtn}>
                Confirm Process flow
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HelpCircle(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  );
}

const BASE_FONT = "Inter, 'Segoe UI', system-ui, -apple-system, sans-serif";

const styles: Record<string, React.CSSProperties> = {
  dashboardShell: {
    fontFamily: BASE_FONT,
    background: "#F8FAFC",
    minHeight: "100vh",
    padding: "32px max(24px, 4vw)",
    boxSizing: "border-box",
    color: "#0F172A",
  },
  loaderContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "60vh",
    gap: 12,
  },
  spinningIcon: {
    color: "#4F46E5",
    animation: "spin 1s linear infinite",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
    flexWrap: "wrap",
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: "-0.025em",
    margin: "0 0 4px 0",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    margin: 0,
  },
  refreshBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: 10,
    padding: "10px 16px",
    fontSize: 13,
    fontWeight: 600,
    color: "#334155",
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
    transition: "all 0.2s ease",
  },
  errorAlert: {
    background: "#FEF2F2",
    border: "1px solid #FECACA",
    color: "#B91C1C",
    borderRadius: 12,
    padding: "14px 18px",
    marginBottom: 24,
    fontSize: 14,
    fontWeight: 500,
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 20,
    marginBottom: 32,
  },
  metricCard: {
    background: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 1px 3px rgba(15,23,42,0.03), 0 4px 12px rgba(15,23,42,0.02)",
    display: "flex",
    flexDirection: "column",
    position: "relative",
  },
  metricHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: {
    fontSize: 26,
    fontWeight: 800,
    color: "#0F172A",
    letterSpacing: "-0.02em",
    marginBottom: 4,
  },
  metricSubtext: {
    fontSize: 12,
    color: "#94A3B8",
  },
  filterBar: {
    background: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    border: "1px solid #E2E8F0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 24,
    boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
  },
  searchContainer: {
    display: "flex",
    alignItems: "center",
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 10,
    padding: "0 14px",
    flex: "1 1 300px",
    position: "relative",
  },
  searchIcon: {
    color: "#94A3B8",
    marginRight: 10,
  },
  searchInput: {
    fontFamily: BASE_FONT,
    border: "none",
    background: "transparent",
    padding: "12px 0",
    fontSize: 14,
    color: "#0F172A",
    outline: "none",
    width: "100%",
  },
  filtersGroup: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  filterField: {
    display: "flex",
    alignItems: "center",
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 10,
    padding: "0 12px",
    gap: 8,
  },
  selectInput: {
    fontFamily: BASE_FONT,
    border: "none",
    background: "transparent",
    padding: "12px 24px 12px 0",
    fontSize: 13,
    fontWeight: 500,
    color: "#334155",
    outline: "none",
    cursor: "pointer",
  },
  dateFieldGroup: {
    display: "flex",
    alignItems: "center",
    background: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 10,
    padding: "0 14px",
    gap: 10,
    height: 43,
  },
  dateInput: {
    fontFamily: BASE_FONT,
    border: "none",
    background: "transparent",
    fontSize: 13,
    color: "#334155",
    outline: "none",
    cursor: "pointer",
  },
  clearFiltersBtn: {
    fontFamily: BASE_FONT,
    background: "transparent",
    border: "none",
    color: "#6366F1",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    padding: "8px 12px",
  },
  tableCard: {
    background: "#FFFFFF",
    borderRadius: 16,
    border: "1px solid #E2E8F0",
    overflow: "hidden",
    boxShadow: "0 4px 20px rgba(15,23,42,0.02)",
  },
  tableHeaderSection: {
    padding: "20px 24px",
    borderBottom: "1px solid #F1F5F9",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tableTitle: {
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
    color: "#0F172A",
  },
  tableBadge: {
    fontSize: 12,
    background: "#F1F5F9",
    color: "#475569",
    padding: "4px 10px",
    borderRadius: 20,
    fontWeight: 500,
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    textAlign: "left" as const,
  },
  thRow: {
    background: "#F8FAFC",
    borderBottom: "1px solid #E2E8F0",
  },
  th: {
    padding: "14px 24px",
    fontSize: 12,
    fontWeight: 600,
    color: "#64748B",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  tr: {
    borderBottom: "1px solid #F1F5F9",
    transition: "background-color 0.15s ease",
  },
  td: {
    padding: "16px 24px",
    fontSize: 14,
    verticalAlign: "middle",
  },
  idBadge: {
    fontFamily: "monospace",
    fontWeight: 600,
    background: "#F1F5F9",
    color: "#334155",
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: 12,
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
  },
  emptyStateTd: {
    padding: "48px 24px",
    textAlign: "center" as const,
    color: "#94A3B8",
    fontSize: 14,
  },
  refundActionBtn: {
    fontFamily: BASE_FONT,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "#EF4444",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 8,
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(239, 68, 68, 0.2)",
    transition: "background 0.2s ease",
  },
  refundedLabelTag: {
    fontSize: 12,
    fontWeight: 700,
    color: "#B91C1C",
    backgroundColor: "#FEE2E2",
    padding: "4px 12px",
    borderRadius: 12,
    textTransform: "uppercase",
    letterSpacing: "0.025em",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  modalContent: {
    fontFamily: BASE_FONT,
    background: "#FFFFFF",
    borderRadius: 16,
    width: "100%",
    maxWidth: "460px",
    padding: "28px",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#0F172A",
    margin: "0 0 6px 0",
  },
  modalDescription: {
    fontSize: 14,
    color: "#64748B",
    margin: "0 0 20px 0",
  },
  modalLabel: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 6,
  },
  radioLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 14,
    color: "#334155",
    cursor: "pointer",
  },
  modalTextInput: {
    fontFamily: BASE_FONT,
    width: "100%",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #E2E8F0",
    background: "#F8FAFC",
    fontSize: 14,
    color: "#0F172A",
    outline: "none",
    boxSizing: "border-box",
  },
  modalSelectInput: {
    fontFamily: BASE_FONT,
    width: "100%",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #E2E8F0",
    background: "#F8FAFC",
    fontSize: 14,
    color: "#334155",
    outline: "none",
    cursor: "pointer",
    boxSizing: "border-box",
  },
  modalActionsRow: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 28,
  },
  modalCancelBtn: {
    fontFamily: BASE_FONT,
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    color: "#475569",
    padding: "10px 16px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  modalConfirmBtn: {
    fontFamily: BASE_FONT,
    background: "#EF4444",
    border: "none",
    color: "#FFFFFF",
    padding: "10px 18px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(239, 68, 68, 0.1)",
  },
};

if (typeof document !== "undefined") {
  const styleId = "revenue-module-animations";
  if (!document.getElementById(styleId)) {
    const el = document.createElement("style");
    el.id = styleId;
    el.textContent = `
      @keyframes spin { to { transform: rotate(360deg); } }
      tr:hover { background-color: #FAFAFB !important; }
    `;
    document.head.appendChild(el);
  }
}