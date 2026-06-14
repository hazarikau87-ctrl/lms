import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase'; // Adjust path to your Supabase client
import { 
  UserPlus, 
  Phone, 
  Award, 
  Percent, 
  CheckCircle, 
  Clock, 
  Wallet, 
  CheckSquare, 
  UserCheck, 
  AlertCircle 
} from 'lucide-react';

interface Doctor {
  id: string;
  lab_id: string;
  name: string;
  phone: string | null;
  specialty: string | null;
  commission_pct: number;
  is_active: boolean;
  created_at: string;
}

interface CommissionTotals {
  pending: number;
  disbursed: number;
}

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingSettleAll, setProcessingSettleAll] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Financial Tracking State
  const [financials, setFinancials] = useState<CommissionTotals>({ pending: 0, disbursed: 0 });

  // Dynamic Lab Context State
  const [labId, setLabId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [commissionPct, setCommissionPct] = useState(10); // Default 10%

  const fmtCurrency = (num: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(num);

  // 1. Fetch the logged-in user's admin profile to map their lab context automatically
  useEffect(() => {
    async function getLabContext() {
      try {
        setAuthLoading(true);
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError) throw authError;

        if (!user) {
          setAuthLoading(false);
          return;
        }

        // AUTOMATIC JUNCTION LOOKUP: Query 'lab_admins' using user_id to resolve lab_id
        const { data: adminData, error: adminError } = await supabase
          .from('lab_admins')
          .select('lab_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (adminError) throw adminError;

        if (adminData?.lab_id) {
          setLabId(adminData.lab_id);
        } else {
          console.error("This user account is not linked to any lab inside lab_admins.");
        }
      } catch (err) {
        console.error("Error fetching user session or lab context:", err);
      } finally {
        setAuthLoading(false);
      }
    }

    getLabContext();
  }, []);

  // 2. Fetch doctors and metrics automatically as soon as the labId state has successfully been resolved
  useEffect(() => {
    if (labId) {
      fetchDoctors(labId);
      fetchCommissionMetrics(labId);
    }
  }, [labId]);

  async function fetchDoctors(activeLabId: string) {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .eq('lab_id', activeLabId) // Secure isolation: only fetch this specific lab's doctors
        .order('name', { ascending: true });

      if (error) throw error;
      setDoctors(data || []);
    } catch (err) {
      console.error('Error fetching doctors:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCommissionMetrics(activeLabId: string) {
    try {
      const { data, error } = await supabase
        .from('doctor_commissions')
        .select('amount, status')
        .eq('lab_id', activeLabId);

      if (error) throw error;

      let pending = 0;
      let disbursed = 0;

      (data || []).forEach((item: any) => {
        const amt = Number(item.amount || 0);
        if (item.status && item.status.toLowerCase() === 'settled') {
          disbursed += amt;
        } else {
          pending += amt;
        }
      });

      setFinancials({ pending, disbursed });
    } catch (err) {
      console.error('Error compiling commission analytics:', err);
    }
  }

  async function handleSettleAllPayments() {
    if (!labId) return;
    if (financials.pending === 0) {
      alert("No pending referral commissions available to settle.");
      return;
    }

    const confirmSettle = window.confirm(
      `Are you sure you want to mark ALL pending payouts (${fmtCurrency(financials.pending)}) as DISBURSED? This cannot be undone.`
    );
    if (!confirmSettle) return;

    try {
      setProcessingSettleAll(true);
      
      const { error } = await supabase
        .from('doctor_commissions')
        .update({ 
          status: 'SETTLED', 
          settled_at: new Date().toISOString() 
        })
        .eq('lab_id', labId)
        .not('status', 'eq', 'SETTLED'); // Targets anything that isn't settled yet

      if (error) throw error;

      // Refresh data matrices after completing the operation
      await fetchCommissionMetrics(labId);
      alert("All operational tracking records updated successfully!");
    } catch (err: any) {
      console.error('Error bulk updating settlements:', err);
      alert('Could not update bulk positions: ' + err.message);
    } finally {
      setProcessingSettleAll(false);
    }
  }

  async function handleCreateDoctor(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !labId) return;

    try {
      const { error } = await supabase
        .from('doctors')
        .insert([{ 
          lab_id: labId, // Links the new doctor directly to this lab workspace
          name: name.trim(), 
          phone: phone.trim() || null,
          specialty: specialty.trim() || null, 
          commission_pct: commissionPct,
          is_active: true 
        }]);

      if (error) throw error;

      // Reset form & refresh list
      setName('');
      setPhone('');
      setSpecialty('');
      setCommissionPct(10);
      setIsModalOpen(false);
      fetchDoctors(labId);
    } catch (err) {
      console.error('Error adding doctor:', err);
    }
  }

  async function toggleDoctorStatus(id: string, currentStatus: boolean) {
    if (!labId) return;
    try {
      const { error } = await supabase
        .from('doctors')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      fetchDoctors(labId);
    } catch (err) {
      console.error('Error updating doctor status:', err);
    }
  }

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <div className="text-gray-500 font-medium tracking-wide text-sm">Verifying institutional credentials...</div>
      </div>
    );
  }

  if (!labId) {
    return (
      <div className="p-6 max-w-xl mx-auto mt-12">
        <div className="bg-rose-50 border border-rose-100 text-rose-900 p-6 rounded-2xl shadow-sm flex items-start space-x-4">
          <AlertCircle className="w-6 h-6 text-rose-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-lg tracking-tight">Laboratory Link Required</p>
            <p className="text-sm mt-1 text-rose-700/90 leading-relaxed">
              We couldn't assign your administrator account to an active laboratory profile workspace. 
              Please verify configuration settings inside your 'lab_admins' table mappings.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 bg-slate-50/50 min-h-screen">
      
      {/* Upper Navigation Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Doctor Directory</h1>
          <p className="text-sm text-slate-500 mt-1">Manage referring clinicians, base structures, and operational balances.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-all shadow-sm hover:shadow active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>Register New Doctor</span>
        </button>
      </div>

      {/* Premium Dashboard KPI Matrix Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Pending Balance */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Awaiting Clearance</p>
              <h3 className="text-2xl font-black text-slate-800 mt-2 tracking-tight font-mono">
                {fmtCurrency(financials.pending)}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> Pending settlement distributions
          </p>
        </div>

        {/* Card 2: Disbursed Distributions */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500"></div>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Cleared Volumes</p>
              <h3 className="text-2xl font-black text-slate-800 mt-2 tracking-tight font-mono">
                {fmtCurrency(financials.disbursed)}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-4 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-emerald-500" /> Disbursed financial balances
          </p>
        </div>

        {/* Card 3: Action Node Workspace */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl shadow-sm flex flex-col justify-between text-white border border-slate-800">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Settlement Clearing Node</p>
              <p className="text-xs text-slate-300 mt-1">Bulk process all system entries instantly.</p>
            </div>
            <Wallet className="w-5 h-5 text-indigo-400" />
          </div>
          
          <button
            onClick={handleSettleAllPayments}
            disabled={processingSettleAll || financials.pending === 0}
            className={`w-full mt-5 inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all border ${
              financials.pending === 0 
                ? 'bg-slate-800/50 border-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600 border-indigo-500 hover:bg-indigo-500 text-white active:scale-[0.98] shadow-lg shadow-indigo-600/10'
            }`}
          >
            {processingSettleAll ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Processing Bulk Clearance...</span>
              </>
            ) : (
              <>
                <CheckSquare className="w-4 h-4" />
                <span>Clear All Pending Payouts</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Workspace Layout Matrix */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-400"></div>
          <div className="text-slate-400 text-sm">Synchronizing doctor registry records...</div>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-2xl overflow-hidden border border-slate-200/80">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-4">Clinician Details</th>
                  <th className="px-6 py-4">Phone Contact</th>
                  <th className="px-6 py-4">Core Specialty</th>
                  <th className="px-6 py-4">Commission Structure</th>
                  <th className="px-6 py-4">Status Indicator</th>
                  <th className="px-6 py-4 text-right">Actions Matrix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-600 font-medium">
                {doctors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-slate-400 bg-slate-50/20">
                      <div className="max-w-xs mx-auto space-y-1">
                        <p className="text-base font-bold text-slate-700">No Doctors Found</p>
                        <p className="text-xs text-slate-400">There are no records found linked to this active workspace channel.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  doctors.map((doctor) => (
                    <tr key={doctor.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 text-sm">{doctor.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">ID: {doctor.id.slice(0, 8)}...</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {doctor.phone ? (
                          <span className="inline-flex items-center gap-1.5 text-slate-600">
                            <Phone className="w-3.5 h-3.5 text-slate-400" /> {doctor.phone}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-normal">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs">
                          <Award className="w-3 h-3 text-slate-500" /> {doctor.specialty || 'General Practitioner'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center font-bold text-slate-800 font-mono">
                          {doctor.commission_pct}<Percent className="w-3 h-3 text-slate-400 ml-0.5" />
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tracking-wide ${
                          doctor.is_active 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' 
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${doctor.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          {doctor.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => toggleDoctorStatus(doctor.id, doctor.is_active)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all active:scale-95 ${
                            doctor.is_active 
                              ? 'bg-white border-rose-200 text-rose-600 hover:bg-rose-50' 
                              : 'bg-white border-slate-200 text-indigo-600 hover:bg-indigo-50'
                          }`}
                        >
                          {doctor.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Premium Input Form Workspace Modal Context Window */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">Register New Doctor</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl font-normal leading-none"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleCreateDoctor} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Dr. Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+91 XXXXX XXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Specialty</label>
                <input
                  type="text"
                  placeholder="Cardiology, Pediatrics, etc."
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Commission Rate (%)</label>
                <div className="relative rounded-xl shadow-sm">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={commissionPct}
                    onChange={(e) => setCommissionPct(Number(e.target.value))}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono font-bold"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <Percent className="w-4 h-4" />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all active:scale-95"
                >
                  Save Doctor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
