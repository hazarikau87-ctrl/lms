import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Search, 
  Filter, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  ArrowUpRight, 
  DollarSign, 
  Users 
} from 'lucide-react';

interface DoctorPerformance {
  id: string;
  name: string;
  specialty: string | null;
  commission_pct: number;
  patientsReferred: number;
  revenueGenerated: number;
  commissionPending: number;
  commissionSettled: number;
}

export default function DoctorLedger({ labId }: { labId: string }) {
  const [performanceData, setPerformanceData] = useState<DoctorPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'has_pending' | 'clear'>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (labId) {
      loadLedgerMetrics();
    }
  }, [labId]);

  async function loadLedgerMetrics() {
    try {
      setLoading(true);

      // 1. Fetch all doctors linked to this lab context
      const { data: docs, error: docsErr } = await supabase
        .from('doctors')
        .select('id, name, specialty, commission_pct')
        .eq('lab_id', labId);

      if (docsErr) throw docsErr;

      // 2. Fetch all commission records to aggregate calculations manually
      const { data: comms, error: commsErr } = await supabase
        .from('doctor_commissions')
        .select('doctor_id, amount, status, commission_pct')
        .eq('lab_id', labId);

      if (commsErr) throw commsErr;

      // Map out financial allocations per doctor
      const metricsMap = (docs || []).map((doc) => {
        const docComms = (comms || []).filter(c => c.doctor_id === doc.id);
        
        let patientsReferred = docComms.length;
        let commissionPending = 0;
        let commissionSettled = 0;
        let revenueGenerated = 0;

        docComms.forEach(c => {
          const amt = Number(c.amount || 0);
          const pct = Number(c.commission_pct || doc.commission_pct || 1);
          
          // Reverse engineer gross revenue contribution from commission share
          if (pct > 0) {
            revenueGenerated += (amt / pct) * 100;
          }

          if (c.status && c.status.toLowerCase() === 'settled') {
            commissionSettled += amt;
          } else {
            commissionPending += amt;
          }
        });

        return {
          id: doc.id,
          name: doc.name,
          specialty: doc.specialty,
          commission_pct: doc.commission_pct,
          patientsReferred,
          revenueGenerated,
          commissionPending,
          commissionSettled
        };
      });

      setPerformanceData(metricsMap);
    } catch (err) {
      console.error("Error processing financial performance data: ", err);
    } finally {
      setLoading(false);
    }
  }

  // Handle individual doctor clearing trigger (GPT Suggestion #4)
  async function settleSingleDoctor(doctorId: string, amount: number, doctorName: string) {
    if (amount <= 0) return;
    
    const confirmSettle = window.confirm(
      `Disburse total outstanding balance of ₹${amount.toLocaleString('en-IN')} to ${doctorName}?`
    );
    if (!confirmSettle) return;

    try {
      setProcessingId(doctorId);

      const { error } = await supabase
        .from('doctor_commissions')
        .update({ 
          status: 'SETTLED', 
          settled_at: new Date().toISOString() 
        })
        .eq('lab_id', labId)
        .eq('doctor_id', doctorId)
        .not('status', 'eq', 'SETTLED'); // Settle only un-cleared items

      if (error) throw error;

      // Soft refresh local aggregate state positions instantly
      setPerformanceData(prev => prev.map(d => d.id === doctorId ? {
        ...d,
        commissionSettled: d.commissionSettled + d.commissionPending,
        commissionPending: 0
      } : d));

    } catch (err: any) {
      alert("Could not process standard disbursement: " + err.message);
    } finally {
      setProcessingId(null);
    }
  }

  // Premium filtering/search mechanisms (GPT Suggestion #5)
  const filteredDocs = useMemo(() => {
    return performanceData.filter(d => {
      const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (d.specialty && d.specialty.toLowerCase().includes(searchQuery.toLowerCase()));
      
      if (statusFilter === 'has_pending') {
        return matchesSearch && d.commissionPending > 0;
      }
      if (statusFilter === 'clear') {
        return matchesSearch && d.commissionPending === 0;
      }
      return matchesSearch;
    });
  }, [performanceData, searchQuery, statusFilter]);

  if (loading) return <div className="text-center py-12 text-slate-400 font-medium text-sm">Analyzing relationship ledger parameters...</div>;

  return (
    <div className="space-y-6">
      
      {/* Search and Filters Configuration Row */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input 
            type="text" 
            placeholder="Search by clinician or specialty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto justify-end">
          <button 
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${statusFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            All Clinicians
          </button>
          <button 
            onClick={() => setStatusFilter('has_pending')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${statusFilter === 'has_pending' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Owed Balance
          </button>
        </div>
      </div>

      {/* Main Account Ledger Matrix Grid View */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-6 py-4">Clinician Profile</th>
                <th className="px-6 py-4 text-center">Patients Referred</th>
                <th className="px-6 py-4 text-right">Revenue Generated</th>
                <th className="px-6 py-4 text-right">Settled Share</th>
                <th className="px-6 py-4 text-right">Pending Share</th>
                <th className="px-6 py-4 text-center">Clearance Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-600">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">No active relationship profiles match your filter options.</td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 text-sm">{doc.name}</div>
                      <div className="text-xs text-slate-400">{doc.specialty || 'General'} • {doc.commission_pct}% rate</div>
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-slate-900 font-bold">
                      {doc.patientsReferred}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-emerald-600 font-bold">
                      ₹{doc.revenueGenerated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-500">
                      ₹{doc.commissionSettled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-amber-600 font-bold text-sm">
                      ₹{doc.commissionPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      {doc.commissionPending > 0 ? (
                        <button
                          onClick={() => settleSingleDoctor(doc.id, doc.commissionPending, doc.name)}
                          disabled={processingId !== null}
                          className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-600 text-indigo-600 hover:text-white font-bold text-xs rounded-lg transition-all"
                        >
                          {processingId === doc.id ? 'Processing...' : 'Settle Owed Balance'}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50">
                          <CheckCircle className="w-3 h-3" /> Settled
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
