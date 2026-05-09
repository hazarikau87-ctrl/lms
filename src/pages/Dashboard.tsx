import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FlaskConical, LogOut, Search, CalendarCheck, Clock, CheckCheck,
  Phone, FileText, Check, Trash2, ChevronLeft, ChevronRight,
  MessageCircle, Building2, FileDown, CheckCircle2, RotateCw, Edit3, X,
  Filter
} from 'lucide-react';
import { supabase, Appointment, Lab } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const RECORDS_PER_PAGE = 10;

const WA_TEMPLATES: Record<string, string> = {
  welcome: 'Hello [NAME], thank you for choosing our lab. Your appointment is confirmed for [DATE] at [TIME].',
  report: 'Hello [NAME], your lab reports for [TEST] are now ready. Please visit our portal to download.',
  reminder: 'Reminder: [NAME], you have an appointment tomorrow ([DATE]) at [TIME]. Please remember to fast if required.',
};

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [lab, setLab] = useState<Lab | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [selectedDate, setSelectedDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: adminLink, error: adminError } = await supabase
        .from('lab_admins')
        .select('lab_id')
        .eq('user_id', user.id)
        .single();

      if (adminError || !adminLink) {
        setLoading(false);
        return;
      }

      const activeLabId = adminLink.lab_id;

      const [labRes, apptRes] = await Promise.all([
        supabase.from('labs').select('id, lab_name, logo_url').eq('id', activeLabId).maybeSingle(),
        supabase.from('appointments').select('*').eq('lab_id', activeLabId).eq('is_deleted', false).order('created_at', { ascending: false }),
      ]);

      if (labRes.data) setLab(labRes.data as Lab);
      if (apptRes.data) setAppointments(apptRes.data as Appointment[]);
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = useMemo(() => {
    let result = appointments;
    if (selectedDate) {
      result = result.filter(a => a.appointment_date === selectedDate);
    }
    const q = search.trim().toUpperCase();
    if (q) {
      result = result.filter(a =>
        a.name?.toUpperCase().includes(q) || a.booking_id?.toUpperCase().includes(q)
      );
    }
    return result;
  }, [appointments, search, selectedDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / RECORDS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * RECORDS_PER_PAGE, currentPage * RECORDS_PER_PAGE);

  const stats = useMemo(() => ({
    total: filtered.length,
    pending: filtered.filter(a => a.status !== 'Completed').length,
    completed: filtered.filter(a => a.status === 'Completed').length,
  }), [filtered]);

  const toggleRow = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(paginated.map(a => a.id)));
    else setSelectedIds(new Set());
  };

  const isAllPageSelected = paginated.length > 0 && paginated.every(a => selectedIds.has(a.id));
  const clearSelection = () => setSelectedIds(new Set());

  const updateStatus = async (id: number, status: string) => {
    await supabase.from('appointments').update({ status }).eq('id', id);
    fetchAll();
  };

  const updateRemarks = async (id: number, remarks: string) => {
    try {
      await supabase.from('appointments').update({ remarks }).eq('id', id);
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, remarks } : a));
    } catch (err) {
      console.error(err);
    }
  };

  const deleteBooking = async (id: number) => {
    if (!confirm('Move this record to trash?')) return;
    await supabase.from('appointments').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', id);
    fetchAll();
  };

  const bulkUpdateStatus = async (status: string) => {
    if (!confirm(`Update ${selectedIds.size} item(s) to ${status}?`)) return;
    await supabase.from('appointments').update({ status }).in('id', Array.from(selectedIds));
    clearSelection();
    fetchAll();
  };

  const bulkDelete = async () => {
    if (!confirm(`Move ${selectedIds.size} record(s) to trash?`)) return;
    await supabase.from('appointments').update({ is_deleted: true, deleted_at: new Date().toISOString() }).in('id', Array.from(selectedIds));
    clearSelection();
    fetchAll();
  };

  const deleteByRange = async () => {
    if (!startDate || !endDate) return alert("Please select both dates.");
    const toDelete = appointments.filter(a => a.appointment_date >= startDate && a.appointment_date <= endDate);
    if (toDelete.length === 0) return alert("No records found.");
    if (!confirm(`Move all ${toDelete.length} records to trash?`)) return;
    await supabase.from('appointments').update({ is_deleted: true, deleted_at: new Date().toISOString() }).in('id', toDelete.map(a => a.id));
    setStartDate(''); setEndDate(''); setShowDatePicker(false);
    fetchAll();
  };

  const sendWhatsApp = (phone: string, type: string, item: Appointment) => {
    if (!type) return;
    const clean = phone.replace(/\D/g, '');
    let msg = `Hello ${item.name}, this is regarding your booking ${item.booking_id}.`;
    if (WA_TEMPLATES[type]) {
      msg = WA_TEMPLATES[type].replace('[NAME]', item.name).replace('[DATE]', item.appointment_date).replace('[TIME]', item.time || 'your scheduled time').replace('[TEST]', item.test);
    }
    window.open(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const generatePDF = async (dataToExport: Appointment[]) => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    if (dataToExport.length === 0) return alert('No data to export.');
    const doc = new jsPDF('p', 'mm', 'a4');
    const labName = lab?.lab_name || 'Partner Lab';
    doc.setFillColor(26, 115, 232); doc.rect(0, 0, 210, 42, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.text(labName.toUpperCase(), 14, 22);
    doc.setFontSize(10); doc.text('Lab Management System', 14, 31);
    const rows = dataToExport.map(item => [item.booking_id, item.name, item.test, `${item.appointment_date}\n${item.time || 'N/A'}`, item.remarks || '-', (item.status || 'Pending').toUpperCase()]);
    autoTable(doc, { startY: 50, head: [['ID', 'Patient', 'Test', 'Schedule', 'Remarks', 'Status']], body: rows, theme: 'striped' });
    doc.save(`${labName}_Report.pdf`);
  };

  const exportToPDF = () => generatePDF(selectedIds.size > 0 ? appointments.filter(a => selectedIds.has(a.id)) : appointments);

  const exportByRange = () => {
    const toExport = appointments.filter(a => a.appointment_date >= startDate && a.appointment_date <= endDate);
    if (toExport.length === 0) return alert(`No appointments found.`);
    generatePDF(toExport);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8">

        {/* --- NAVBAR / HEADER --- */}
        <header className="bg-white/80 backdrop-blur-md sticky top-4 z-30 rounded-2xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] px-6 py-4 mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
              <div className="relative w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                <FlaskConical className="w-6 h-6 text-white" />
              </div>
            </div>
            
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Lab Management</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Next Appointment • Live</p>
              </div>
            </div>

            <div className="hidden lg:block w-px h-10 bg-slate-100 mx-2" />

            <div className="hidden md:flex items-center gap-3 bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2 shadow-inner">
               <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-sm">
                 {lab?.logo_url ? <img src={lab.logo_url} className="w-full h-full object-cover" /> : <Building2 className="w-4 h-4 text-slate-400" />}
               </div>
               <span className="text-sm font-bold text-slate-700">{loading ? '...' : (lab?.lab_name || 'Partner Lab')}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50 transition-all duration-300">
              <CalendarCheck className="w-4 h-4 text-slate-400" />
              <input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setCurrentPage(1); }} className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 p-0 outline-none" />
              {selectedDate && <button onClick={() => setSelectedDate('')}><X className="w-3 h-3 text-slate-400 hover:text-red-500" /></button>}
            </div>

            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Search patient or ID..."
                className="pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-400 w-48 lg:w-64 transition-all duration-300 outline-none"
              />
            </div>

            <button onClick={signOut} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95">
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </header>

        {/* --- STATS SECTION --- */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <StatCard icon={<Filter className="w-5 h-5 text-blue-600" />} color="blue" value={stats.total} label="Total Records" />
          <StatCard icon={<Clock className="w-5 h-5 text-amber-600" />} color="amber" value={stats.pending} label="Awaiting Completion" />
          <StatCard icon={<CheckCheck className="w-5 h-5 text-emerald-600" />} color="emerald" value={stats.completed} label="Successful Tests" />
        </div>

        {/* --- BULK ACTIONS FLOATING BAR --- */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white rounded-2xl px-6 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center gap-6 animate-in fade-in zoom-in slide-in-from-bottom-4 duration-300">
            <span className="text-sm font-bold border-r border-slate-700 pr-6">{selectedIds.size} Selected</span>
            <div className="flex gap-2">
              <button onClick={() => bulkUpdateStatus('Completed')} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-xs font-bold transition-colors">
                <CheckCircle2 className="w-4 h-4" /> Complete
              </button>
              <button onClick={exportToPDF} className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-xl text-xs font-bold transition-colors">
                <FileDown className="w-4 h-4" /> PDF
              </button>
              <button onClick={bulkDelete} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl text-xs font-bold transition-all">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
              <button onClick={clearSelection} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        )}

        {/* --- MAIN TABLE CARD --- */}
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-slate-100 bg-slate-50/30">
            <div className="flex items-center gap-3">
               <input type="checkbox" checked={isAllPageSelected} onChange={e => toggleSelectAll(e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer" />
               <span className="text-sm font-bold text-slate-500">Select Page</span>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={fetchAll} className={`p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:shadow-sm transition-all ${loading ? 'opacity-50' : ''}`}>
                <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              
              <div className="h-8 w-px bg-slate-200 mx-1" />

              {!showDatePicker ? (
                <button onClick={() => setShowDatePicker(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all">
                  <CalendarCheck className="w-4 h-4" /> Range Tools
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-blue-50/50 border border-blue-100 p-1 rounded-xl">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-white border-slate-200 rounded-lg text-xs font-bold p-1.5 focus:ring-2 focus:ring-blue-500" />
                  <span className="text-[10px] font-black text-blue-300">TO</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-white border-slate-200 rounded-lg text-xs font-bold p-1.5 focus:ring-2 focus:ring-blue-500" />
                  <button onClick={exportByRange} className="p-2 text-blue-600 hover:bg-white rounded-lg transition-colors"><FileDown className="w-4 h-4" /></button>
                  <button onClick={deleteByRange} className="p-2 text-red-500 hover:bg-white rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                  <button onClick={() => setShowDatePicker(false)} className="p-2 text-slate-400"><Check className="w-4 h-4" /></button>
                </div>
              )}

              <button onClick={exportToPDF} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-all">
                <FileDown className="w-4 h-4" /> Export All
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="w-14 px-6 py-5"></th>
                  <th className="px-4 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Identification</th>
                  <th className="px-4 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Patient Details</th>
                  <th className="px-4 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Documents</th>
                  <th className="px-4 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Communication</th>
                  <th className="px-4 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Schedule</th>
                  <th className="px-4 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Lab Remarks</th>
                  <th className="px-4 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={9} className="py-24 text-center"><RotateCw className="w-8 h-8 animate-spin mx-auto text-blue-500/20" /></td></tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-24 text-center">
                      <div className="max-w-xs mx-auto">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                          <Search className="w-8 h-8 text-slate-200" />
                        </div>
                        <h3 className="text-slate-900 font-bold">No results found</h3>
                        <p className="text-slate-500 text-xs mt-1">We couldn't find any appointments matching your current filters.</p>
                      </div>
                    </td>
                  </tr>
                ) : paginated.map(item => (
                  <AppointmentRow key={item.id} item={item} selected={selectedIds.has(item.id)} onToggle={() => toggleRow(item.id)} onUpdateStatus={updateStatus} onUpdateRemarks={updateRemarks} onDelete={deleteBooking} onWhatsApp={sendWhatsApp} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-8 py-5 border-t border-slate-100 bg-slate-50/20">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Showing <span className="text-slate-900">{paginated.length}</span> of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition-all"><ChevronLeft className="w-4 h-4" /></button>
              <div className="flex items-center gap-1 mx-2">
                <span className="text-sm font-bold text-slate-900">{currentPage}</span>
                <span className="text-sm font-bold text-slate-400">/</span>
                <span className="text-sm font-bold text-slate-400">{totalPages}</span>
              </div>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 transition-all"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, color, value, label }: { icon: React.ReactNode; color: string; value: number; label: string }) {
  const themes: any = {
    blue: "from-blue-500/10 to-transparent border-blue-100 text-blue-700",
    amber: "from-amber-500/10 to-transparent border-amber-100 text-amber-700",
    emerald: "from-emerald-500/10 to-transparent border-emerald-100 text-emerald-700",
  };

  return (
    <div className={`bg-white rounded-3xl border p-6 shadow-[0_10px_20px_-10px_rgba(0,0,0,0.04)] relative overflow-hidden group hover:shadow-lg transition-all duration-300`}>
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${themes[color]} opacity-40 -mr-8 -mt-8 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500`}></div>
      <div className="relative z-10">
        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mb-4 border border-slate-100 shadow-sm">{icon}</div>
        <p className="text-3xl font-black text-slate-900 tracking-tight">{value}</p>
        <p className="text-xs font-bold text-slate-400 uppercase mt-1 tracking-widest">{label}</p>
      </div>
    </div>
  );
}

function AppointmentRow({ item, selected, onToggle, onUpdateStatus, onUpdateRemarks, onDelete, onWhatsApp }: any) {
  const isCompleted = item.status === 'Completed';
  const [localRemarks, setLocalRemarks] = useState(item.remarks || '');
  useEffect(() => { setLocalRemarks(item.remarks || ''); }, [item.remarks]);

  return (
    <tr className={`group transition-all duration-200 ${selected ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'}`}>
      <td className="px-6 py-4 text-center">
        <input type="checkbox" checked={selected} onChange={onToggle} className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
      </td>
      <td className="px-4 py-4">
        <span className="inline-flex px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-mono text-[11px] font-bold border border-slate-200 shadow-sm">
          #{item.booking_id}
        </span>
      </td>
      <td className="px-4 py-4">
        <p className="font-bold text-slate-900 text-sm">{item.name}</p>
        <p className="text-[11px] font-bold text-slate-400 uppercase mt-0.5">{item.age ?? 'N/A'}Y • {item.gender || 'N/A'}</p>
      </td>
      <td className="px-4 py-4">
        {item.prescription_url ? (
          <a href={item.prescription_url.startsWith('http') ? item.prescription_url : supabase.storage.from('prescriptions').getPublicUrl(item.prescription_url).data.publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[11px] font-bold hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm">
            <FileText className="w-3.5 h-3.5" /> View
          </a>
        ) : <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">No Upload</span>}
      </td>
      <td className="px-4 py-4">
        <a href={`tel:${item.mobile}`} className="flex items-center gap-1.5 text-slate-700 text-xs font-bold hover:text-blue-600 transition-colors">
          <div className="w-5 h-5 rounded-md bg-blue-50 flex items-center justify-center"><Phone className="w-3 h-3 text-blue-600" /></div>
          {item.mobile}
        </a>
        <div className="flex items-center gap-2 mt-2">
          <select defaultValue="" onChange={e => { onWhatsApp(item.mobile, e.target.value, item); e.target.value = ''; }} className="text-[10px] font-bold px-2 py-1 rounded-md border border-slate-200 bg-white text-slate-600 cursor-pointer focus:ring-2 focus:ring-blue-500 outline-none shadow-sm">
            <option value="">TEMPLATES</option>
            <option value="welcome">Welcome</option>
            <option value="report">Reports</option>
            <option value="reminder">Reminder</option>
          </select>
          <button onClick={() => onWhatsApp(item.mobile, 'default', item)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors" title="Quick Chat">
            <MessageCircle className="w-4 h-4" />
          </button>
        </div>
      </td>
      <td className="px-4 py-4">
        <p className="font-bold text-slate-800 text-sm leading-tight">{item.test}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <Clock className="w-3 h-3 text-slate-300" />
          <p className="text-[11px] font-bold text-slate-500">{item.appointment_date}</p>
        </div>
      </td>
      <td className="px-4 py-4 min-w-[200px]">
        <div className="relative group/edit">
          <textarea
            value={localRemarks}
            onChange={(e) => setLocalRemarks(e.target.value)}
            onBlur={() => onUpdateRemarks(item.id, localRemarks)}
            placeholder="Click to add note..."
            rows={1}
            className="w-full text-[11px] font-medium p-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-50/50 outline-none resize-none transition-all"
          />
          <Edit3 className="absolute right-2 top-2 w-3 h-3 text-slate-300 opacity-0 group-hover/edit:opacity-100 transition-opacity" />
        </div>
      </td>
      <td className="px-4 py-4 text-center">
        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${isCompleted ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100 shadow-sm'}`}>
          {item.status || 'Pending'}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isCompleted && (
            <button onClick={() => onUpdateStatus(item.id, 'Completed')} className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-sm text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 flex items-center justify-center transition-all">
              <Check className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => onDelete(item.id)} className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-sm text-red-500 hover:bg-red-50 hover:border-red-200 flex items-center justify-center transition-all">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
