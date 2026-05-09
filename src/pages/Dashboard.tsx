import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FlaskConical, LogOut, Search, CalendarCheck, Clock, CheckCheck,
  Phone, FileText, Check, Trash2, ChevronLeft, ChevronRight,
  MessageCircle, Building2, FileDown, CheckCircle2, RotateCw, Edit3, X
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

  // Date filter state
  const [selectedDate, setSelectedDate] = useState('');

  // Range-based date states
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
        console.error("No lab assigned to this user");
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
      console.error("Error updating remarks:", err);
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
    const toDelete = appointments.filter(a => 
      a.appointment_date >= startDate && a.appointment_date <= endDate
    );
    if (toDelete.length === 0) return alert("No records found in this range.");
    if (!confirm(`Move all ${toDelete.length} records from ${startDate} to ${endDate} to trash?`)) return;
    const idsToDelete = toDelete.map(a => a.id);
    await supabase.from('appointments').update({ is_deleted: true, deleted_at: new Date().toISOString() }).in('id', idsToDelete);
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
    if (dataToExport.length === 0) { alert('No data to export.'); return; }
    const doc = new jsPDF('p', 'mm', 'a4');
    const labName = lab?.lab_name || 'Partner Lab';
    doc.setFillColor(26, 115, 232); doc.rect(0, 0, 210, 42, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.text(labName.toUpperCase(), 14, 22);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text('Generated via Lab Management System by Next Appointment', 14, 31);
    doc.setFontSize(9); doc.text(`Exported on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 14, 38);
    const rows = dataToExport.map(item => [item.booking_id, { content: `${item.name}\n${item.age ?? 'N/A'}Y / ${item.gender || ''}\n${item.mobile || 'N/A'}`, styles: { fontStyle: 'bold' as const } }, item.test, `${item.appointment_date}\n${item.time || 'N/A'}`, item.remarks || '-', { content: (item.status || 'Pending').toUpperCase(), styles: { textColor: item.status === 'Completed' ? [46, 125, 50] as [number, number, number] : [194, 65, 12] as [number, number, number], fontStyle: 'bold' as const } } ]);
    autoTable(doc, { startY: 50, head: [['ID', 'Patient Details', 'Test', 'Schedule', 'Remarks', 'Status']], body: rows, theme: 'striped', headStyles: { fillColor: [26, 115, 232] as [number, number, number] }, styles: { fontSize: 9, valign: 'middle' } });
    doc.save(`${labName}_Report.pdf`);
  };

  const exportToPDF = () => {
    const dataToExport = selectedIds.size > 0 ? appointments.filter(a => selectedIds.has(a.id)) : appointments;
    generatePDF(dataToExport);
  };

  const exportByRange = () => {
    if (!startDate || !endDate) return alert("Please select both dates.");
    const toExport = appointments.filter(a => a.appointment_date >= startDate && a.appointment_date <= endDate);
    if (toExport.length === 0) return alert(`No appointments found for this range.`);
    generatePDF(toExport);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">

        {/* Header - Enhanced Shadows */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] px-6 py-4 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_4px_12px_rgba(37,99,235,0.25)] flex-shrink-0">
                <FlaskConical className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>Lab Management System</h1>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">By Next Appointment</p>
              </div>
            </div>

            <div className="w-px h-9 bg-gray-200 hidden sm:block" />

            {/* Pill with inner shadow and border */}
            <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] rounded-full px-3 py-1.5">
              <div className="w-7 h-7 rounded-full border border-gray-200 bg-white shadow-sm overflow-hidden flex items-center justify-center flex-shrink-0">
                {lab?.logo_url ? (
                  <img src={lab.logo_url} alt="lab logo" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                )}
              </div>
              <span className="text-sm font-semibold text-gray-800">
                {loading ? 'Loading...' : (lab?.lab_name || 'Partner Lab')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Input Pills with deeper focus state */}
            <div className="relative flex items-center gap-2 bg-gray-50 border border-gray-200 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:bg-white focus-within:border-blue-400 transition-all">
              <CalendarCheck className="w-4 h-4 text-gray-400" />
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => { setSelectedDate(e.target.value); setCurrentPage(1); }}
                className="bg-transparent border-none text-xs text-gray-900 focus:ring-0 p-0 outline-none cursor-pointer"
              />
              {selectedDate && (
                <button onClick={() => setSelectedDate('')} className="p-0.5 hover:bg-gray-200 rounded-full">
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              )}
            </div>

            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Search ID or Name..."
                className="pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white focus:border-blue-400 w-56 transition-all"
              />
            </div>
            <button onClick={signOut} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm bg-white text-sm font-semibold text-red-500 hover:bg-red-50 hover:border-red-200 hover:shadow-md transition-all active:scale-95">
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard icon={<CalendarCheck className="w-5 h-5 text-sky-600" />} iconBg="bg-sky-50" value={stats.total} label={selectedDate ? `Appointments on ${selectedDate}` : "Total Appointments"} />
          <StatCard icon={<Clock className="w-5 h-5 text-amber-600" />} iconBg="bg-amber-50" value={stats.pending} label="Pending Tests" />
          <StatCard icon={<CheckCheck className="w-5 h-5 text-emerald-600" />} iconBg="bg-emerald-50" value={stats.completed} label="Completed" />
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="bg-white border border-blue-100 shadow-[0_10px_20px_-5px_rgba(37,99,235,0.15)] rounded-2xl px-5 py-3 mb-5 flex flex-wrap items-center justify-between gap-3 animate-[slideDown_0.2s_ease-out]">
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
               <span className="text-sm font-bold text-blue-700">{selectedIds.size} Selected</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => bulkUpdateStatus('Completed')} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-emerald-700 border border-emerald-100 shadow-sm rounded-lg text-xs font-bold hover:bg-emerald-50 hover:border-emerald-200 transition-all"><CheckCircle2 className="w-3.5 h-3.5" /> Mark Done</button>
              <button onClick={bulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-red-700 border border-red-100 shadow-sm rounded-lg text-xs font-bold hover:bg-red-50 hover:border-red-200 transition-all"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
              <button onClick={exportToPDF} className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white border border-blue-700 shadow-[0_4px_10px_rgba(37,99,235,0.3)] rounded-lg text-xs font-bold hover:bg-blue-700 hover:shadow-blue-500/40 transition-all active:scale-95"><FileDown className="w-3.5 h-3.5" /> Export PDF</button>
            </div>
          </div>
        )}

        {/* Main Table Container */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_4px_25px_-5px_rgba(0,0,0,0.08)] overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100 bg-gray-50/40">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg shadow-sm">
              <input type="checkbox" checked={isAllPageSelected} onChange={e => toggleSelectAll(e.target.checked)} className="w-4 h-4 accent-blue-600 cursor-pointer rounded border-gray-300 transition-all" />
              <label className="text-[11px] font-bold text-gray-500 cursor-pointer select-none uppercase tracking-tight">Select Page</label>
            </div>
            
            <div className="ml-auto flex items-center gap-2">
              <button onClick={fetchAll} title="Refresh data" className={`flex items-center justify-center w-9 h-9 text-gray-500 border border-gray-200 bg-white shadow-sm rounded-xl hover:text-blue-600 hover:border-blue-200 hover:shadow-md transition-all ${loading ? 'opacity-50' : ''}`} disabled={loading}>
                <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <div className="relative flex items-center gap-2">
                {!showDatePicker ? (
                  <button onClick={() => setShowDatePicker(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 border border-gray-200 bg-white shadow-sm rounded-xl hover:text-blue-600 hover:border-blue-200 hover:shadow-md transition-all">
                    <CalendarCheck className="w-3.5 h-3.5" /> Bulk Range
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-white border border-blue-200 p-1.5 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] animate-[fadeIn_0.2s_ease]">
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-xs border-none bg-slate-50 rounded-lg focus:ring-0 text-gray-700 p-1.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]" />
                    <span className="text-[10px] text-gray-400 font-black">TO</span>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-xs border-none bg-slate-50 rounded-lg focus:ring-0 text-gray-700 p-1.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]" />
                    {startDate && endDate && (
                      <div className="flex items-center border-l border-gray-100 ml-1 pl-1 gap-1">
                        <button onClick={exportByRange} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"><FileDown className="w-3.5 h-3.5" /></button>
                        <button onClick={deleteByRange} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                    <button onClick={() => { setShowDatePicker(false); setStartDate(''); setEndDate(''); }} className="p-1.5 text-gray-400 hover:text-gray-600 border-l border-gray-100 ml-1"><X className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
              <button onClick={exportToPDF} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 border border-gray-200 bg-white shadow-sm rounded-xl hover:text-blue-600 hover:border-blue-200 hover:shadow-md transition-all">
                <FileDown className="w-3.5 h-3.5" /> PDF
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/30">
                  <th className="w-10 px-4 py-4"></th>
                  <th className="px-4 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-widest">Booking ID</th>
                  <th className="px-4 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-widest">Patient Details</th>
                  <th className="px-4 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-widest">Prescription</th>
                  <th className="px-4 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-widest">Communication</th>
                  <th className="px-4 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-widest">Test / Schedule</th>
                  <th className="px-4 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-widest">Lab Remarks</th>
                  <th className="px-4 py-4 text-left text-[11px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="px-4 py-4 text-right text-[11px] font-black text-slate-500 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan={9} className="py-24 text-center"><RotateCw className="w-8 h-8 animate-spin mx-auto text-blue-500 opacity-20" /></td></tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-20 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <Search className="w-10 h-10 opacity-10 mb-2" />
                        <p className="text-sm font-semibold text-slate-500">No appointments found</p>
                        <p className="text-xs text-slate-400">Try adjusting your filters or search terms.</p>
                      </div>
                    </td>
                  </tr>
                ) : paginated.map(item => (
                  <AppointmentRow key={item.id} item={item} selected={selectedIds.has(item.id)} onToggle={() => toggleRow(item.id)} onUpdateStatus={updateStatus} onUpdateRemarks={updateRemarks} onDelete={deleteBooking} onWhatsApp={sendWhatsApp} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-center gap-6 px-6 py-5 border-t border-gray-100 bg-gray-50/30">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 bg-white shadow-sm rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all"><ChevronLeft className="w-4 h-4" /> Previous</button>
            <div className="px-3 py-1 bg-slate-100 rounded-lg shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200">
                <span className="text-xs font-bold text-slate-600">Page {currentPage} <span className="text-slate-400 font-medium">of</span> {totalPages}</span>
            </div>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 bg-white shadow-sm rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all">Next <ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-components with Shading
function StatCard({ icon, iconBg, value, label }: { icon: React.ReactNode; iconBg: string; value: number; label: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.05)] px-5 py-5 flex items-center gap-4 hover:-translate-y-1 hover:shadow-[0_12px_20px_-8px_rgba(0,0,0,0.1)] transition-all duration-300 cursor-default group">
      <div className={`w-12 h-12 rounded-2xl ${iconBg} shadow-sm flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>{icon}</div>
      <div>
        <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function AppointmentRow({ item, selected, onToggle, onUpdateStatus, onUpdateRemarks, onDelete, onWhatsApp }: any) {
  const isCompleted = item.status === 'Completed';
  const [localRemarks, setLocalRemarks] = useState(item.remarks || '');
  useEffect(() => { setLocalRemarks(item.remarks || ''); }, [item.remarks]);
  const handleRemarksBlur = () => { if (localRemarks !== (item.remarks || '')) { onUpdateRemarks(item.id, localRemarks); } };

  return (
    <tr className={`group border-b border-slate-50 transition-colors ${selected ? 'bg-blue-50/40' : 'hover:bg-slate-50/40'}`}>
      <td className="px-4 py-4 text-center">
        <input type="checkbox" checked={selected} onChange={onToggle} className="w-4 h-4 accent-blue-600 cursor-pointer rounded border-gray-300 shadow-sm transition-all" />
      </td>
      <td className="px-4 py-4">
        <span className="bg-white text-indigo-700 px-2.5 py-1.5 rounded-lg font-mono font-black text-xs border border-indigo-100 shadow-[0_2px_4px_rgba(79,70,229,0.08)]">
          {item.booking_id}
        </span>
      </td>
      <td className="px-4 py-4">
        <p className="font-bold text-slate-900 text-sm">{item.name}</p>
        <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{item.age ?? 'N/A'}Y &bull; {item.gender || 'N/A'}</p>
      </td>
      <td className="px-4 py-4">
        {item.prescription_url ? ( 
          <a href={item.prescription_url.startsWith('http') ? item.prescription_url : supabase.storage.from('prescriptions').getPublicUrl(item.prescription_url).data.publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 hover:text-blue-600 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95">
            <FileText className="w-3.5 h-3.5" /> View
          </a> 
        ) : <span className="text-xs text-slate-300 font-medium italic">No upload</span>}
      </td>
      <td className="px-4 py-4">
        <a href={`tel:${item.mobile}`} className="flex items-center gap-1.5 text-slate-700 text-xs hover:text-blue-600 transition-colors font-bold tracking-tight">
          <Phone className="w-3 h-3 text-slate-400" /> {item.mobile}
        </a>
        <div className="flex items-center gap-2 mt-2">
          <select defaultValue="" onChange={e => { onWhatsApp(item.mobile, e.target.value, item); e.target.value = ''; }} className="text-[10px] font-bold px-2 py-1.5 rounded-lg border border-slate-200 bg-white shadow-sm text-slate-600 hover:border-slate-300 cursor-pointer focus:ring-2 focus:ring-blue-500/10 outline-none">
            <option value="">TEMPLATES</option>
            <option value="welcome">Welcome</option>
            <option value="report">Reports</option>
            <option value="reminder">Reminder</option>
          </select>
          <button onClick={() => onWhatsApp(item.mobile, 'default', item)} className="flex items-center gap-1 text-[11px] font-black text-emerald-600 hover:text-emerald-700 hover:underline transition-all">
            <MessageCircle className="w-3.5 h-3.5" /> CHAT
          </button>
        </div>
      </td>
      <td className="px-4 py-4">
        <p className="font-bold text-slate-900 text-sm">{item.test}</p>
        <div className="flex items-center gap-1.5 mt-1">
            <CalendarCheck className="w-3 h-3 text-blue-400" />
            <p className="text-[11px] text-slate-500 font-bold">{item.appointment_date} <span className="text-slate-300 mx-0.5">@</span> {item.time || 'N/A'}</p>
        </div>
      </td>
      <td className="px-4 py-4 min-w-[200px]">
        <div className="relative group/remarks">
          <textarea 
            value={localRemarks} 
            onChange={(e) => setLocalRemarks(e.target.value)} 
            onBlur={handleRemarksBlur} 
            placeholder="Click to add remarks..." 
            rows={1} 
            className="w-full text-[11px] font-medium p-2.5 bg-slate-50/50 border border-slate-200 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] rounded-xl focus:bg-white focus:border-blue-300 focus:shadow-md focus:ring-0 outline-none resize-none transition-all placeholder:text-slate-300" 
          />
          <Edit3 className="absolute right-2 top-2.5 w-3 h-3 text-slate-300 opacity-0 group-hover/remarks:opacity-100 transition-opacity pointer-events-none" />
        </div>
      </td>
      <td className="px-4 py-4">
        <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm transition-all ${isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
          {item.status || 'Pending'}
        </span>
      </td>
      <td className="px-4 py-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => onUpdateStatus(item.id, 'Completed')} title="Mark Completed" className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-sm text-emerald-600 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 hover:shadow-lg hover:shadow-emerald-200 flex items-center justify-center transition-all active:scale-90">
            <Check className="w-4 h-4 stroke-[3px]" />
          </button>
          <button onClick={() => onDelete(item.id)} title="Delete" className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-sm text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 hover:shadow-lg hover:shadow-red-200 flex items-center justify-center transition-all active:scale-90">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
