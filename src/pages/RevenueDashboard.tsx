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
  RotateCcw,
  UserCheck,
  CheckCircle2,
  Clock,
  Undo2
} from "lucide-react";
import { supabase } from "../lib/supabase";

type PaymentMethod = "cash" | "upi" | "card_external" | "all" | "refunded";
type DashboardView = "payments" | "commissions";
type CommissionStatusFilter = "all" | "unpaid" | "settled";

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

interface CommissionRecord {
  id: string | number;
  appointment_id: number;
  booking_id: string;
  doctor_name: string;
  total_test_value: number;
  commission_amount: number;
  status: "unpaid" | "settled";
  settled_at?: string;
  created_at: string;
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
  const [activeView, setActiveView] = useState<DashboardView>("payments");
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [error, setError] = useState("");
  
  // Shared Filters
  const [startDate, setStartDate] = useState(getTodayString());
  const [endDate, setEndDate] = useState(getTodayString());
  const [searchQuery, setSearchQuery] = useState("");

  // Conditional Filter Selectors
  const [methodFilter, setMethodFilter] = useState<PaymentMethod>("all");
  const [commissionFilter, setCommissionFilter] = useState<CommissionStatusFilter>("all");

  // Refund Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [refundType, setRefundType] = useState<"full" | "custom">("full");
  const [customAmount, setCustomAmount] = useState("");
  const [refundThrough, setRefundThrough] = useState<"upi" | "cash" | "bank_transfer">("upi");

  useEffect(() => {
    if (labId) {
      loadDashboardData();
    }
  }, [labId]);

  async function loadDashboardData() {
    setLoading(true);
    setError("");
    try {
      const { data: payData, error: payError } = await supabase
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

      const formattedPayments: PaymentRecord[] = (payData || []).map((item: any) => {
        const appointmentObj = Array.isArray(item.appointments) ? item.appointments[0] : item.appointments;
        return {
          ...item,
          booking_id: appointmentObj?.booking_id || `N/A (Appt #${item.appointment_id})`
        };
      });

      const { data: commData, error: commError } = await supabase
        .from("doctor_commissions")
        .select("id, appointment_id, doctor_id, amount, commission_pct, status, settled_at, created_at")
        .eq("lab_id", labId)
        .order("created_at", { ascending: false });

      if (commError) throw commError;

      let formattedCommissions: CommissionRecord[] = [];

      if (commData && commData.length > 0) {
        const appointmentIds = Array.from(new Set(commData.map(c => c.appointment_id).filter(Boolean)));
        const doctorIds = Array.from(new Set(commData.map(c => c.doctor_id).filter(Boolean)));

        const { data: appts } = await supabase
          .from("appointments")
          .select("id, booking_id")
          .in("id", appointmentIds);

        const { data: docs } = await supabase
          .from("doctors")
          .select("id, name")
          .in("id", doctorIds);

        const appointmentMap = Object.fromEntries((appts || []).map(a => [a.id, a.booking_id]));
        const doctorMap = Object.fromEntries((docs || []).map(d => [d.id, d.name]));

        formattedCommissions = commData.map((item: any) => {
          const pct = item.commission_pct || 1;
          const calculatedTotalTestValue = ((item.amount || 0) / pct) * 100;

          return {
            id: item.id,
            appointment_id: item.appointment_id,
            booking_id: appointmentMap[item.appointment_id] || `N/A (Appt #${item.appointment_id})`,
            doctor_name: doctorMap[item.doctor_id] || "Unknown Doctor",
            total_test_value: calculatedTotalTestValue,
            commission_amount: item.amount || 0,
            status: item.status ? item.status.toLowerCase() : "unpaid",
            settled_at: item.settled_at,
            created_at: item.created_at
          };
        });
      }

      setPayments(formattedPayments);
      setCommissions(formattedCommissions);
    } catch (err: any) {
      console.error("Dashboard database fetch error: ", err);
      setError("Failed to fetch dashboard operational metrics: " + (err.message || err.details || JSON.stringify(err)));
    } finally {
      setLoading(false);
    }
  }

  async function toggleCommissionStatus(comm: CommissionRecord) {
    const databaseStatusPayload = comm.status === "unpaid" ? "SETTLED" : "UNPAID";
    const nextFrontendStatus = comm.status === "unpaid" ? "settled" : "unpaid";
    
    try {
      const { error: updateErr } = await supabase
        .from("doctor_commissions")
        .update({ 
          status: databaseStatusPayload,
          settled_at: nextFrontendStatus === "settled" ? new Date().toISOString() : null
        })
        .eq("id", comm.id);

      if (updateErr) throw updateErr;

      setCommissions(prev => prev.map(c => c.id === comm.id ? { 
        ...c, 
        status: nextFrontendStatus,
        settled_at: nextFrontendStatus === "settled" ? new Date().toISOString() : undefined
      } : c));
    } catch (err: any) {
      alert("Could not update commission settlement tracking state: " + err.message);
    }
  }

  async function handleProcessRefund() {
    if (!selectedPayment) return;
    const finalRefundAmount = refundType === "full" ? selectedPayment.amount_paid : Number(customAmount);

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
          return { ...p, is_refunded: true, refunded_amount: finalRefundAmount, refund_method: refundThrough };
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

  const clearFilters = () => {
    setMethodFilter("all");
    setCommissionFilter("all");
    setStartDate(getTodayString());
    setEndDate(getTodayString());
    setSearchQuery("");
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (methodFilter === "refunded") {
        if (!p.is_refunded) return false;
      } else if (methodFilter !== "all" && p.payment_method !== methodFilter) {
        return false;
      }
      if (startDate) {
        const start = new Date(startDate); start.setHours(0, 0, 0, 0);
        if (new Date(p.created_at) < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate); end.setHours(23, 59, 59, 999);
        if (new Date(p.created_at) > end) return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return p.transaction_ref?.toLowerCase().includes(query) || 
               p.booking_id?.toLowerCase().includes(query) || 
               p.notes?.toLowerCase().includes(query);
      }
      return true;
    });
  }, [payments, methodFilter, startDate, endDate, searchQuery]);

  const filteredCommissions = useMemo(() => {
    return commissions.filter((c) => {
      if (commissionFilter !== "all" && c.status !== commissionFilter) return false;
      if (startDate) {
        const start = new Date(startDate); start.setHours(0, 0, 0, 0);
        if (new Date(c.created_at) < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate); end.setHours(23, 59, 59, 999);
        if (new Date(c.created_at) > end) return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return c.doctor_name.toLowerCase().includes(query) || c.booking_id.toLowerCase().includes(query);
      }
      return true;
    });
  }, [commissions, commissionFilter, startDate, endDate, searchQuery]);

  const financialTotals = useMemo(() => {
    let grossRevenue = 0;
    let totalRefunds = 0;
    
    let cashGross = 0;
    let upiGross = 0;
    let cardGross = 0;

    payments.forEach((p) => {
      const pAmount = Number(p.amount_paid || 0);
      const refAmount = p.is_refunded ? Number(p.refunded_amount || 0) : 0;
      
      grossRevenue += pAmount;
      totalRefunds += refAmount;

      if (p.payment_method === "cash") {
        cashGross += pAmount;
      }
      if (p.payment_method === "upi") {
        upiGross += pAmount;
      }
      if (p.payment_method === "card_external") {
        cardGross += pAmount;
      }
    });

    // Refunds are explicitly deducted only from cash allocations
    const cashNet = cashGross - totalRefunds;
    const isCashNegative = cashNet < 0;

    let totalCommissionOwed = 0;
    let settledCommissions = 0;
    let unpaidCommissions = 0;

    commissions.forEach((c) => {
      totalCommissionOwed += c.commission_amount;
      if (c.status === "settled") settledCommissions += c.commission_amount;
      else unpaidCommissions += c.commission_amount;
    });

    return { 
      netRevenue: grossRevenue - totalRefunds,
      grossRevenue,
      totalRefunds,
      cashNet,
      isCashNegative,
      upiNet: upiGross, // Dynamic design constraint: no refund deductions applied here
      cardNet: cardGross, // Dynamic design constraint: no refund deductions applied here
      cashGross, upiGross, cardGross,
      totalCommissionOwed, settledCommissions, unpaidCommissions 
    };
  }, [payments, commissions]);

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
      {/* Upper Navigation Section */}
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>Revenue & Accounts Analytics</h1>
          <p style={styles.subtitle}>Real-time overview of transaction flows, gross volumes, and channel channels</p>
        </div>
        <button onClick={loadDashboardData} style={styles.refreshBtn}>
          <RefreshCw size={14} /> Sync Ledgers
        </button>
      </div>

      {error && <div style={styles.errorAlert}><span>⚠</span> {error}</div>}

      {/* Premium Multi-Channel Interactive KPI Container Rows */}
      <div style={styles.metricsGrid}>
        {/* Card 1: Net Cumulative Revenue */}
        <div style={{ ...styles.metricCard, borderTop: "4px solid #4F46E5" }}>
          <div style={styles.metricHeader}>
            <span style={styles.metricLabel}>Net Register Revenue</span>
            <div style={{ ...styles.iconWrapper, background: "#EEF2FF", color: "#4F46E5" }}><TrendingUp size={18} /></div>
          </div>
          <div style={styles.metricValue}>{fmt(financialTotals.netRevenue)}</div>
          <div style={styles.channelBreakdownList}>
            <div style={styles.breakdownRow}>
              <span style={styles.breakdownLabel}>Gross Inflow</span>
              <span style={styles.breakdownValPositive}>{fmt(financialTotals.grossRevenue)}</span>
            </div>
          </div>
        </div>

        {/* Card 2: UPI Ledger Streams */}
        <div style={{ ...styles.metricCard, borderTop: "4px solid #8B5CF6" }}>
          <div style={styles.metricHeader}>
            <span style={styles.metricLabel}>UPI Node Volume</span>
            <div style={{ ...styles.iconWrapper, background: "#F5F3FF", color: "#8B5CF6" }}><Smartphone size={18} /></div>
          </div>
          <div style={styles.metricValue}>{fmt(financialTotals.upiNet)}</div>
          <div style={styles.channelBreakdownList}>
            <div style={styles.breakdownRow}>
              <span style={styles.breakdownLabel}>Share Weight</span>
              <span style={styles.breakdownBadge}>
                {financialTotals.grossRevenue > 0 
                  ? ((financialTotals.upiGross / financialTotals.grossRevenue) * 100).toFixed(1) + "%" 
                  : "0.0%"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: External Cards POS Terminal */}
        <div style={{ ...styles.metricCard, borderTop: "4px solid #3B82F6" }}>
          <div style={styles.metricHeader}>
            <span style={styles.metricLabel}>Card POS Terminal</span>
            <div style={{ ...styles.iconWrapper, background: "#EFF6FF", color: "#3B82F6" }}><CreditCard size={18} /></div>
          </div>
          <div style={styles.metricValue}>{fmt(financialTotals.cardNet)}</div>
          <div style={styles.channelBreakdownList}>
            <div style={styles.breakdownRow}>
              <span style={styles.breakdownLabel}>Share Weight</span>
              <span style={styles.breakdownBadge}>
                {financialTotals.grossRevenue > 0 
                  ? ((financialTotals.cardGross / financialTotals.grossRevenue) * 100).toFixed(1) + "%" 
                  : "0.0%"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Cash Desk Bookings (Handles Negative Deficits Gracefully) */}
        <div style={{ 
          ...styles.metricCard, 
          borderTop: financialTotals.isCashNegative ? "4px solid #EF4444" : "4px solid #10B981",
          backgroundColor: financialTotals.isCashNegative ? "#FEF2F2" : "#FFFFFF"
        }}>
          <div style={styles.metricHeader}>
            <span style={{ 
              ...styles.metricLabel, 
              color: financialTotals.isCashNegative ? "#991B1B" : "#64748B" 
            }}>
              {financialTotals.isCashNegative ? "Cash Counter Deficit" : "Cash Counter Flow"}
            </span>
            <div style={{ 
              ...styles.iconWrapper, 
              background: financialTotals.isCashNegative ? "#FEE2E2" : "#F0FDF4", 
              color: financialTotals.isCashNegative ? "#EF4444" : "#10B981" 
            }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ 
            ...styles.metricValue, 
            color: financialTotals.isCashNegative ? "#DC2626" : "#0F172A" 
          }}>
            {financialTotals.isCashNegative ? "-" : ""}{fmt(Math.abs(financialTotals.cashNet))}
          </div>
          <div style={styles.channelBreakdownList}>
            <div style={styles.breakdownRow}>
              <span style={styles.breakdownLabel}>Gross Collected</span>
              <span style={styles.breakdownTextSubtle}>{fmt(financialTotals.cashGross)}</span>
            </div>
          </div>
        </div>

        {/* Card 5: Dedicated Refund Management Ledger */}
        <div style={{ ...styles.metricCard, borderTop: "4px solid #64748B", backgroundColor: "#F8FAFC" }}>
          <div style={styles.metricHeader}>
            <span style={styles.metricLabel}>Total Refunds Issued</span>
            <div style={{ ...styles.iconWrapper, background: "#E2E8F0", color: "#475569" }}><Undo2 size={18} /></div>
          </div>
          <div style={{ ...styles.metricValue, color: "#475569" }}>{fmt(financialTotals.totalRefunds)}</div>
          <div style={styles.channelBreakdownList}>
            <div style={styles.breakdownRow}>
              <span style={styles.breakdownLabel}>Deduction Policy</span>
              <span style={{ ...styles.breakdownBadge, color: "#991B1B", backgroundColor: "#FEE2E2", fontWeight: 600 }}>
                100% Cash Adjusted
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Meta Row: Commission Tracking Subsets */}
      <div style={styles.metaSummaryRow}>
        <div style={styles.metaItem}>
          <UserCheck size={14} style={{ color: "#F59E0B" }} />
          <span>Accrued Referral Liability: <strong>{fmt(financialTotals.totalCommissionOwed)}</strong></span>
        </div>
        <div style={styles.metaItemDivider} />
        <div style={styles.metaItem}>
          <Clock size={14} style={{ color: "#EF4444" }} />
          <span>Awaiting Settlement: <strong style={{ color: "#DC2626" }}>{fmt(financialTotals.unpaidCommissions)}</strong></span>
        </div>
        <div style={styles.metaItemDivider} />
        <div style={styles.metaItem}>
          <CheckCircle2 size={14} style={{ color: "#10B981" }} />
          <span>Disbursed Distributions: <strong style={{ color: "#16A34A" }}>{fmt(financialTotals.settledCommissions)}</strong></span>
        </div>
      </div>

      {/* Navigation View Switcher */}
      <div style={styles.tabsContainer}>
        <button 
          onClick={() => setActiveView("payments")} 
          style={{ ...styles.tabButton, ...(activeView === "payments" ? styles.activeTabButton : {}) }}
        >
          Payments Register Matrix
        </button>
        <button 
          onClick={() => setActiveView("commissions")} 
          style={{ ...styles.tabButton, ...(activeView === "commissions" ? styles.activeTabButton : {}) }}
        >
          Doctor Referral Commissions
        </button>
      </div>

      {/* Query Control Filter Workspace */}
      <div style={styles.filterBar}>
        <div style={styles.searchContainer}>
          <Search size={18} style={styles.searchIcon} />
          <input
            type="text"
            placeholder={activeView === "payments" ? "Search Reference, Booking ID..." : "Search Doctor, Booking ID..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div style={styles.filtersGroup}>
          {activeView === "payments" ? (
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
          ) : (
            <div style={styles.filterField}>
              <Filter size={14} style={{ color: "#64748B" }} />
              <select
                value={commissionFilter}
                onChange={(e) => setCommissionFilter(e.target.value as CommissionStatusFilter)}
                style={styles.selectInput}
              >
                <option value="all">All Status Matrix</option>
                <option value="unpaid">Awaiting Clearance (Unpaid)</option>
                <option value="settled">Cleared Distributions (Settled)</option>
              </select>
            </div>
          )}

          <div style={styles.dateFieldGroup}>
            <Calendar size={14} style={{ color: "#64748B" }} />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={styles.dateInput} />
            <span style={{ color: "#94A3B8" }}>to</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={styles.dateInput} />
          </div>

          {(startDate !== getTodayString() || endDate !== getTodayString() || methodFilter !== "all" || commissionFilter !== "all" || searchQuery) && (
            <button onClick={clearFilters} style={styles.clearFiltersBtn}>Reset Filters</button>
          )}
        </div>
      </div>

      {/* Main Content Workspace Layout Matrix */}
      <div style={styles.tableCard}>
        {activeView === "payments" ? (
          <>
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
                    <tr><td colSpan={7} style={styles.emptyStateTd}>No matching tracking logs found.</td></tr>
                  ) : (
                    filteredPayments.map((p) => {
                      const methodCfg = METHOD_DETAILS[p.payment_method] || { label: p.payment_method, icon: DollarSign, color: "#64748B", bg: "#F1F5F9" };
                      const IconComponent = methodCfg.icon;
                      return (
                        <tr key={p.id} style={p.is_refunded ? { ...styles.tr, backgroundColor: "#FEF2F2" } : styles.tr}>
                          <td style={styles.td}>
                            <div style={{ fontWeight: 500, color: "#0F172A" }}>{new Date(p.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{new Date(p.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                          </td>
                          <td style={styles.td}><span style={styles.idBadge}>{p.booking_id}</span></td>
                          <td style={styles.td}>
                            <span style={{ ...styles.statusBadge, color: methodCfg.color, backgroundColor: methodCfg.bg }}>
                              <IconComponent size={12} style={{ marginRight: 4 }} />{methodCfg.label}
                            </span>
                          </td>
                          <td style={{ ...styles.td, fontFamily: "monospace", fontSize: 13, color: "#475569" }}>{p.transaction_ref || <span style={{ color: "#CBD5E1" }}>—</span>}</td>
                          <td style={{ ...styles.td, color: "#64748B", fontSize: 13 }}>{p.notes || "No remarks configured"}</td>
                          <td style={{ ...styles.td, textAlign: "right", fontWeight: 700, color: p.is_refunded ? "#DC2626" : "#0F172A", fontSize: 15 }}>
                            {p.is_refunded ? (
                              <div>
                                <span style={{ fontSize: 12, fontWeight: 500, color: "#EF4444", display: "block", marginBottom: 2 }}>(Refunded {fmt(p.refunded_amount || 0)})</span>
                                <span style={{ textDecoration: "line-through", color: "#94A3B8", fontSize: 13 }}>{fmt(p.amount_paid)}</span>
                              </div>
                            ) : fmt(p.amount_paid)}
                          </td>
                          <td style={{ ...styles.td, textAlign: "center" }}>
                            {p.is_refunded ? <span style={styles.refundedLabelTag}>Refunded</span> : (
                              <button onClick={() => openRefundModal(p)} style={styles.refundActionBtn}>
                                <RotateCcw size={12} style={{ marginRight: 4 }} /> Refund
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
          </>
        ) : (
          <>
            <div style={styles.tableHeaderSection}>
              <h2 style={styles.tableTitle}>Accrued Referral Settlements Matrix</h2>
              <span style={styles.tableBadge}>{filteredCommissions.length} allocations match</span>
            </div>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thRow}>
                    <th style={styles.th}>Timestamp</th>
                    <th style={styles.th}>Booking ID</th>
                    <th style={styles.th}>Consultant Doctor</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Total Test Gross Value</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Commission Payout (Amt)</th>
                    <th style={{ ...styles.th, textAlign: "center" }}>State Tracking</th>
                    <th style={{ ...styles.th, textAlign: "center" }}>Action Trigger</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCommissions.length === 0 ? (
                    <tr><td colSpan={7} style={styles.emptyStateTd}>No explicit doctor referral metrics detected in this view parameters.</td></tr>
                  ) : (
                    filteredCommissions.map((c) => (
                      <tr key={c.id} style={styles.tr}>
                        <td style={styles.td}>
                          <div style={{ fontWeight: 500, color: "#0F172A" }}>{new Date(c.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                        </td>
                        <td style={styles.td}><span style={styles.idBadge}>{c.booking_id}</span></td>
                        <td style={{ ...styles.td, fontWeight: 600, color: "#1E293B" }}>{c.doctor_name}</td>
                        <td style={{ ...styles.td, textAlign: "right", color: "#64748B" }}>{fmt(c.total_test_value)}</td>
                        <td style={{ ...styles.td, textAlign: "right", fontWeight: 700, color: "#059669", fontSize: 15 }}>{fmt(c.commission_amount)}</td>
                        <td style={{ ...styles.td, textAlign: "center" }}>
                          <span style={{
                            ...styles.statusBadge,
                            color: c.status === "settled" ? "#10B981" : "#D97706",
                            backgroundColor: c.status === "settled" ? "#F0FDF4" : "#FFFBEB"
                          }}>
                            {c.status === "settled" ? "Disbursed" : "Accruing Balance"}
                          </span>
                        </td>
                        <td style={{ ...styles.td, textAlign: "center" }}>
                          <button 
                            onClick={() => toggleCommissionStatus(c)}
                            style={{
                              ...styles.actionToggleBtn,
                              backgroundColor: c.status === "settled" ? "#64748B" : "#4F46E5"
                            }}
                          >
                            {c.status === "settled" ? "Mark Unpaid" : "Disburse / Settle"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Refund Interface Modal Context Window */}
      {isModalOpen && selectedPayment && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Initiate Refund Record</h3>
            <p style={styles.modalDescription}>Processing workflow for Booking Reference ID: <strong style={{ color: "#0F172A" }}>{selectedPayment.booking_id}</strong></p>

            <div style={{ marginBottom: 18 }}>
              <label style={styles.modalLabel}>Refund Scope</label>
              <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                <label style={styles.radioLabel}>
                  <input type="radio" name="refundType" checked={refundType === "full"} onChange={() => setRefundType("full")} />
                  Full Refund ({fmt(selectedPayment.amount_paid)})
                </label>
                <label style={styles.radioLabel}>
                  <input type="radio" name="refundType" checked={refundType === "custom"} onChange={() => setRefundType("custom")} />
                  Custom Allocation
                </label>
              </div>
            </div>

            {refundType === "custom" && (
              <div style={{ marginBottom: 18 }}>
                <label style={styles.modalLabel}>Allocation Custom Value (₹)</label>
                <input type="number" max={selectedPayment.amount_paid} placeholder="Enter explicit refund value flow" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} style={styles.modalTextInput} />
              </div>
            )}

            <div style={{ marginBottom: 24 }}>
              <label style={styles.modalLabel}>Outbound Settlement Channel</label>
              <select value={refundThrough} onChange={(e) => setRefundThrough(e.target.value as any)} style={styles.modalSelectInput}>
                <option value="cash">Cash Counter Disbursal (Deducts from Cash Pot)</option>
                <option value="upi">UPI Web Node (Deducts from Cash Pot)</option>
                <option value="bank_transfer">Direct Corporate Bank Transfer (Deducts from Cash Pot)</option>
              </select>
            </div>

            <div style={styles.modalActionsRow}>
              <button onClick={closeRefundModal} style={styles.modalCancelBtn}>Abort Window</button>
              <button onClick={handleProcessRefund} style={styles.modalConfirmBtn}>Confirm & Disburse</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const BASE_FONT = "Inter, 'Segoe UI', system-ui, -apple-system, sans-serif";
const styles: Record<string, React.CSSProperties> = {
  dashboardShell: { fontFamily: BASE_FONT, background: "#F8FAFC", minHeight: "100vh", padding: "32px max(24px, 4vw)", boxSizing: "border-box", color: "#0F172A" },
  loaderContainer: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 12 },
  spinningIcon: { color: "#4F46E5", animation: "spin 1s linear infinite" },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 16 },
  title: { fontSize: 26, fontWeight: 800, letterSpacing: "-0.025em", margin: "0 0 4px 0", color: "#0F172A" },
  subtitle: { fontSize: 14, color: "#64748B", margin: 0 },
  refreshBtn: { display: "inline-flex", alignItems: "center", gap: 8, background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#334155", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)", transition: "all 0.2s ease" },
  errorAlert: { background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", borderRadius: 12, padding: "14px 18px", marginBottom: 24, fontSize: 14, fontWeight: 500 },
  
  metricsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 },
  metricCard: { background: "#FFFFFF", borderRadius: 16, padding: "20px 24px", boxShadow: "0 1px 3px rgba(15,23,42,0.02), 0 4px 12px rgba(15,23,42,0.015)", display: "flex", flexDirection: "column", border: "1px solid #E2E8F0", transition: "all 0.2s ease" },
  metricHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  metricLabel: { fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" },
  iconWrapper: { width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" },
  metricValue: { fontSize: 24, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.03em", marginBottom: 12, fontVariantNumeric: "tabular-nums" },
  
  channelBreakdownList: { borderTop: "1px dashed #E2E8F0", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 },
  breakdownRow: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 },
  breakdownLabel: { color: "#94A3B8", fontWeight: 500 },
  breakdownValPositive: { color: "#10B981", fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  breakdownValNegative: { color: "#EF4444", fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  breakdownTextSubtle: { color: "#475569", fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  breakdownBadge: { background: "#F1F5F9", color: "#475569", padding: "2px 6px", borderRadius: 6, fontWeight: 700, fontSize: 11, fontVariantNumeric: "tabular-nums" },
  
  metaSummaryRow: { display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", background: "#FFFFFF", padding: "12px 20px", borderRadius: 12, border: "1px solid #E2E8F0", marginBottom: 32, fontSize: 13, color: "#475569" },
  metaItem: { display: "flex", alignItems: "center", gap: 8 },
  metaItemDivider: { width: 1, height: 16, background: "#E2E8F0" },

  tabsContainer: { display: "flex", gap: 8, borderBottom: "2px solid #E2E8F0", marginBottom: 20, paddingBottom: 2 },
  tabButton: { border: "none", background: "transparent", padding: "10px 20px", fontSize: 14, fontWeight: 600, color: "#64748B", cursor: "pointer", borderBottom: "2px solid transparent", marginBottom: "-4px", transition: "all 0.15s ease" },
  activeTabButton: { color: "#4F46E5", borderBottom: "2px solid #4F46E5" },
  filterBar: { background: "#FFFFFF", borderRadius: 16, padding: 16, border: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 24 },
  searchContainer: { display: "flex", alignItems: "center", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "0 14px", flex: "1 1 300px" },
  searchIcon: { color: "#94A3B8", marginRight: 10 },
  searchInput: { border: "none", background: "transparent", padding: "12px 0", fontSize: 14, color: "#0F172A", outline: "none", width: "100%" },
  filtersGroup: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  filterField: { display: "flex", alignItems: "center", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "0 12px", gap: 8 },
  selectInput: { border: "none", background: "transparent", padding: "12px 24px 12px 0", fontSize: 13, fontWeight: 500, color: "#334155", outline: "none", cursor: "pointer" },
  dateFieldGroup: { display: "flex", alignItems: "center", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "0 14px", gap: 10, height: 43 },
  dateInput: { border: "none", background: "transparent", fontSize: 13, color: "#334155", outline: "none", cursor: "pointer" },
  clearFiltersBtn: { background: "transparent", border: "none", color: "#6366F1", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "8px 12px" },
  tableCard: { background: "#FFFFFF", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 4px 20px rgba(15,23,42,0.02)" },
  tableHeaderSection: { padding: "20px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" },
  tableTitle: { fontSize: 16, fontWeight: 700, margin: 0, color: "#0F172A" },
  tableBadge: { fontSize: 12, background: "#F1F5F9", color: "#475569", padding: "4px 10px", borderRadius: 20, fontWeight: 500 },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", textAlign: "left" },
  thRow: { background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" },
  th: { padding: "14px 24px", fontSize: 12, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" },
  tr: { borderBottom: "1px solid #F1F5F9" },
  td: { padding: "16px 24px", fontSize: 14, verticalAlign: "middle" },
  idBadge: { fontFamily: "monospace", fontWeight: 600, background: "#F1F5F9", color: "#334155", padding: "4px 8px", borderRadius: 6, fontSize: 12 },
  statusBadge: { display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 },
  emptyStateTd: { padding: "48px 24px", textAlign: "center", color: "#94A3B8", fontSize: 14 },
  refundActionBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: "#EF4444", color: "#FFFFFF", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  refundedLabelTag: { fontSize: 12, fontWeight: 700, color: "#B91C1C", backgroundColor: "#FEE2E2", padding: "4px 12px", borderRadius: 12, textTransform: "uppercase" },
  actionToggleBtn: { border: "none", color: "#FFFFFF", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 },
  modalContent: { background: "#FFFFFF", borderRadius: 16, width: "100%", maxWidth: "460px", padding: "28px" },
  modalTitle: { fontSize: 18, fontWeight: 700, color: "#0F172A", margin: "0 0 6px 0" },
  modalDescription: { fontSize: 14, color: "#64748B", margin: "0 0 20px 0" },
  modalLabel: { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", textTransform: "uppercase", marginBottom: 6 },
  radioLabel: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#334155", cursor: "pointer" },
  modalTextInput: { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #E2E8F0", background: "#F8FAFC", fontSize: 14, outline: "none", boxSizing: "border-box" },
  modalSelectInput: { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #E2E8F0", background: "#F8FAFC", fontSize: 14, outline: "none", cursor: "pointer", boxSizing: "border-box" },
  modalActionsRow: { display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 28 },
  modalCancelBtn: { background: "#FFFFFF", border: "1px solid #E2E8F0", color: "#475569", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  modalConfirmBtn: { background: "#EF4444", border: "none", color: "#FFFFFF", padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }
};
