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
  ArrowUpRight
} from "lucide-react";
import { supabase } from "../lib/supabase";

type PaymentMethod = "cash" | "upi" | "card_external" | "all";

interface PaymentRecord {
  id: string | number;
  appointment_id: number;
  lab_id: string;
  amount_paid: number;
  payment_method: "cash" | "upi" | "card_external";
  transaction_ref?: string;
  notes?: string;
  created_at: string;
}

const fmt = (n: number) =>
  "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const METHOD_DETAILS = {
  cash: { label: "Cash", icon: DollarSign, color: "#10B981", bg: "#F0FDF4" },
  upi: { label: "UPI", icon: Smartphone, color: "#8B5CF6", bg: "#F5F3FF" },
  card_external: { label: "Card", icon: CreditCard, color: "#3B82F6", bg: "#EFF6FF" },
};

export default function RevenueDashboard({ labId }: { labId: string }) {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [error, setError] = useState("");
  
  // Filters
  const [methodFilter, setMethodFilter] = useState<PaymentMethod>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

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
        .select("*")
        .eq("lab_id", labId)
        .order("created_at", { ascending: false });

      if (payError) throw payError;
      setPayments(data || []);
    } catch (err: any) {
      setError("Failed to fetch operational metrics: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Pure filtering logic
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      // 1. Payment Method Filter
      if (methodFilter !== "all" && p.payment_method !== methodFilter) return false;

      // 2. Date Range Filter
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

      // 3. Search Query Filter (Ref or Appointment ID)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesRef = p.transaction_ref?.toLowerCase().includes(query);
        const matchesAppt = String(p.appointment_id).includes(query);
        const matchesNotes = p.notes?.toLowerCase().includes(query);
        if (!matchesRef && !matchesAppt && !matchesNotes) return false;
      }

      return true;
    });
  }, [payments, methodFilter, startDate, endDate, searchQuery]);

  // Aggregate Metrics derived from filtered data
  const metrics = useMemo(() => {
    let total = 0;
    let cash = 0;
    let upi = 0;
    let card = 0;

    filteredPayments.forEach((p) => {
      const amt = Number(p.amount_paid || 0);
      total += amt;
      if (p.payment_method === "cash") cash += amt;
      if (p.payment_method === "upi") upi += amt;
      if (p.payment_method === "card_external") card += amt;
    });

    return { total, cash, upi, card };
  }, [filteredPayments]);

  const clearFilters = () => {
    setMethodFilter("all");
    setStartDate("");
    setEndDate("");
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
        <div style={{ ...styles.metricCard, borderTop: "4px solid #4F46E5" }}>
          <div style={styles.metricHeader}>
            <span style={styles.metricLabel}>Total Revenue</span>
            <div style={{ ...styles.iconWrapper, background: "#EEF2FF", color: "#4F46E5" }}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div style={styles.metricValue}>{fmt(metrics.total)}</div>
          <div style={styles.metricSubtext}>Aggregate net processed flow</div>
        </div>

        <div style={{ ...styles.metricCard, borderTop: `4px solid ${METHOD_DETAILS.cash.color}` }}>
          <div style={styles.metricHeader}>
            <span style={styles.metricLabel}>Cash Payments</span>
            <div style={{ ...styles.iconWrapper, background: METHOD_DETAILS.cash.bg, color: METHOD_DETAILS.cash.color }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div style={styles.metricValue}>{fmt(metrics.cash)}</div>
          <div style={styles.metricSubtext}>Physical cash register balance</div>
        </div>

        <div style={{ ...styles.metricCard, borderTop: `4px solid ${METHOD_DETAILS.upi.color}` }}>
          <div style={styles.metricHeader}>
            <span style={styles.metricLabel}>UPI Volume</span>
            <div style={{ ...styles.iconWrapper, background: METHOD_DETAILS.upi.bg, color: METHOD_DETAILS.upi.color }}>
              <Smartphone size={20} />
            </div>
          </div>
          <div style={styles.metricValue}>{fmt(metrics.upi)}</div>
          <div style={styles.metricSubtext}>Direct instant bank settlements</div>
        </div>

        <div style={{ ...styles.metricCard, borderTop: `4px solid ${METHOD_DETAILS.card_external.color}` }}>
          <div style={styles.metricHeader}>
            <span style={styles.metricLabel}>Card Terminals</span>
            <div style={{ ...styles.iconWrapper, background: METHOD_DETAILS.card_external.bg, color: METHOD_DETAILS.card_external.color }}>
              <CreditCard size={20} />
            </div>
          </div>
          <div style={styles.metricValue}>{fmt(metrics.card)}</div>
          <div style={styles.metricSubtext}>External card merchant volume</div>
        </div>
      </div>

      {/* Control Filter Bar */}
      <div style={styles.filterBar}>
        <div style={styles.searchContainer}>
          <Search size={18} style={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search Reference, Appt ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div style={styles.filtersGroup}>
          {/* Method Selector */}
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
            </select>
          </div>

          {/* Date Parameters */}
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

          {(startDate || endDate || methodFilter !== "all" || searchQuery) && (
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
                <th style={styles.th}>Appointment ID</th>
                <th style={styles.th}>Channel Method</th>
                <th style={styles.th}>Reference Identification</th>
                <th style={styles.th}>Notes / Remarks</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Flow Volume</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} style={styles.emptyStateTd}>
                    No specific payments found aligning with the active telemetry criteria.
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

                  return (
                    <tr key={p.id} style={styles.tr}>
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
                        <span style={styles.idBadge}>#{p.appointment_id}</span>
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
                      <td style={{ ...styles.td, textAlign: "right", fontWeight: 700, color: "#0F172A", fontSize: 15 }}>
                        {fmt(p.amount_paid)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Help component fallback
function HelpCircle(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  );
}

// Premium Production Stylesheet
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
};

// Injection of animations for loader element
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