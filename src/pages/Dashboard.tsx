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
    /* Changed bg-slate-50 to a radial gradient for a shaded background effect */
    <div className="min-h-screen bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-50 via-slate-100 to-gray-200">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">

        {/* Header - Shaded Border Applied */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.07)] px-6 py-4 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/20 flex-shrink-0">
                <FlaskConical className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>Lab Management System</h1>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">By Next Appointment</p>
              </div>
            </div>

            <div className="w-px h-9 bg-gray-200 hidden sm:block" />

            <div className="flex items-center gap-2.5 bg-slate-50 border border-gray-200 shadow-inner rounded-full px-3 py-1.5">
              <div className="w-7 h-7 rounded-full border border-gray-200 bg-white overflow-hidden flex items-center justify-center flex-shrink-0">
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
            <div className="relative flex items-center gap-2 bg-gray-50 border border-gray-200 shadow-sm rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
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

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Search ID or Name..."
                className="pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 shadow-sm bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-56 transition"
              />
            </div>
            <button onClick={signOut} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm bg-white text-sm font-semibold text-red-500 hover:bg-red-50 hover:border-red-200 transition">
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        {/* Stats - Shaded Border Applied */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard icon={<CalendarCheck className="w-5 h-5 text-sky-600" />} iconBg="bg-sky-50" value={stats.total} label={selectedDate ? `Appointments on ${selectedDate}` : "Total Appointments"} />
          <StatCard icon={<Clock className="w-5 h-5 text-amber-600" />} iconBg="bg-amber-50" value={stats.pending} label="Pending Tests" />
          <StatCard icon={<CheckCheck className="w-5 h-5 text-emerald-600" />} iconBg="bg-emerald-50" value={stats.completed} label="Completed" />
        </div>

        {/* Bulk Actions - Shaded Border Applied */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border border-blue-200 shadow-md rounded-xl px-5 py-3 mb-5 flex flex-wrap items-center justify-between gap-3 animate-[slideDown_0.25s_ease]">
            <span className="text-sm font-semibold text-blue-700">{selectedIds.size} Selected</span>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => bulkUpdateStatus('Completed')} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-emerald-700 border border-emerald-200 shadow-sm rounded-lg text-xs font-semibold hover:bg-emerald-100 transition"><CheckCircle2 className="w-3.5 h-3.5" /> Mark Done</button>
              <button onClick={bulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-red-700 border border-red-200 shadow-sm rounded-lg text-xs font-semibold hover:bg-red-100 transition"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
              <button onClick={exportToPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white border border-blue-700 shadow-sm rounded-lg text-xs font-semibold hover:bg-blue-700 transition"><FileDown className="w-3.5 h-3.5" /> Export PDF</button>
            </div>
          </div>
        )}

        {/* Table Card - Shaded Border Applied */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.1)] overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-100 bg-gray-50/50">
            <input type="checkbox" checked={isAllPageSelected} onChange={e => toggleSelectAll(e.target.checked)} className="w-4 h-4 accent-blue-600 cursor-pointer rounded border-gray-300 shadow-sm" />
            <label className="text-xs font-medium text-gray-500 cursor-pointer select-none">Select all on this page</label>
            
            <div className="ml-auto flex items-center gap-2">
              <button onClick={fetchAll} title="Refresh data" className={`flex items-center justify-center p-1.5 text-gray-500 border border-gray-200 bg-white shadow-sm rounded-lg hover:text-blue-600 hover:border-blue-200 transition-all ${loading ? 'opacity-50' : ''}`} disabled={loading}>
                <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <div className="relative flex items-center gap-2">
                {!showDatePicker ? (
                  <button onClick={() => setShowDatePicker(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 bg-white shadow-sm rounded-lg hover:text-blue-600 hover:border-blue-200 transition">
                    <CalendarCheck className="w-3.5 h-3.5" /> Bulk Action (Range)
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-white border border-blue-200 p-1.5 rounded-lg shadow-md">
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-xs border-none bg-gray-50 rounded-md focus:ring-0 text-gray-700 p-1 shadow-inner" />
                    <span className="text-[10px] text-gray-400 font-bold">TO</span>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-xs border-none bg-gray-50 rounded-md focus:ring-0 text-gray-700 p-1 shadow-inner" />
                    {startDate && endDate && (
                      <div className="flex items-center border-l ml-1 pl-1 gap-1">
                        <button onClick={exportByRange} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition"><FileDown className="w-3.5 h-3.5" /></button>
                        <button onClick={deleteByRange} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                    <button onClick={() => { setShowDatePicker(false); setStartDate(''); setEndDate(''); }} className="p-1.5 text-gray-400 hover:text-gray-600 border-l ml-1"><Check className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
              <button onClick={exportToPDF} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 bg-white shadow-sm rounded-lg hover:text-blue-600 hover:border-blue-200 transition">
                <FileDown className="w-3.5 h-3.5" /> Export All PDF
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="border-b-2 border-slate-100">
                  <th className="w-10 px-4 py-3"></th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Booking ID</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Patient</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Prescription</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Contact & WhatsApp</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Test / Schedule</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Remarks by lab</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-blue-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="py-16 text-center"><RotateCw className="w-6 h-6 animate-spin mx-auto text-blue-500" /></td></tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-20 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <Search className="w-10 h-10 opacity-10 mb-2" />
                        <p className="text-sm font-medium">No appointment found.</p>
                        <p className="text-xs">{selectedDate ? `Nothing scheduled for ${selectedDate}` : "Try adjusting your search query."}</p>
                      </div>
                    </td>
                  </tr>
                ) : paginated.map(item => (
                  <AppointmentRow key={item.id} item={item} selected={selectedIds.has(item.id)} onToggle={() => toggleRow(item.id)} onUpdateStatus={updateStatus} onUpdateRemarks={updateRemarks} onDelete={deleteBooking} onWhatsApp={sendWhatsApp} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-center gap-4 px-6 py-4 border-t border-gray-100 bg-gray-50/30">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 bg-white shadow-sm rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"><ChevronLeft className="w-4 h-4" /> Prev</button>
            <span className="text-sm font-medium text-gray-600">Page {currentPage} of {totalPages}</span>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 bg-white shadow-sm rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition">Next <ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-components
function StatCard({ icon, iconBg, value, label }: { icon: React.ReactNode; iconBg: string; value: number; label: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] px-5 py-4 flex items-center gap-4 hover:-translate-y-0.5 transition-all duration-200">
      <div className={`w-12 h-12 rounded-xl ${iconBg} shadow-sm flex items-center justify-center flex-shrink-0`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
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
    <tr className={`border-b border-gray-50 hover:bg-slate-50/50 transition-colors ${selected ? 'bg-blue-50/40' : ''}`}>
      <td className="px-4 py-4 text-center"><input type="checkbox" checked={selected} onChange={onToggle} className="w-4 h-4 accent-blue-600 cursor-pointer rounded border-gray-300" /></td>
      <td className="px-4 py-4"><span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg font-mono font-bold text-xs border border-indigo-100 shadow-sm">{item.booking_id}</span></td>
      <td className="px-4 py-4"><p className="font-semibold text-gray-900 text-sm">{item.name}</p><p className="text-xs text-gray-400 mt-0.5">{item.age ?? 'N/A'}Y &bull; {item.gender || 'N/A'}</p></td>
      <td className="px-4 py-4">{item.prescription_url ? ( <a href={item.prescription_url.startsWith('http') ? item.prescription_url : supabase.storage.from('prescriptions').getPublicUrl(item.prescription_url).data.publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium transition"><FileText className="w-3.5 h-3.5" /> View</a> ) : <span className="text-xs text-gray-400 italic">No Upload</span>}</td>
      <td className="px-4 py-4"><a href={`tel:${item.mobile}`} className="flex items-center gap-1.5 text-gray-700 text-xs hover:text-blue-600 transition font-medium"><Phone className="w-3 h-3" /> {item.mobile}</a><div className="flex items-center gap-2 mt-1.5"><select defaultValue="" onChange={e => { onWhatsApp(item.mobile, e.target.value, item); e.target.value = ''; }} className="text-[11px] px-1.5 py-1 rounded-md border border-gray-200 bg-white shadow-sm text-gray-600 max-w-[90px] cursor-pointer"><option value="">Templates</option><option value="welcome">Welcome</option><option value="report">Reports</option><option value="reminder">Reminder</option></select><button onClick={() => onWhatsApp(item.mobile, 'default', item)} className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 transition"><MessageCircle className="w-3.5 h-3.5" /> Chat</button></div></td>
      <td className="px-4 py-4"><p className="font-semibold text-gray-900 text-sm">{item.test}</p><p className="text-xs text-gray-400 mt-0.5 font-medium">{item.appointment_date} @ {item.time || 'N/A'}</p></td>
      <td className="px-4 py-4 min-w-[180px]"><div className="relative group"><textarea value={localRemarks} onChange={(e) => setLocalRemarks(e.target.value)} onBlur={handleRemarksBlur} placeholder="Add remarks..." rows={1} className="w-full text-[11px] p-2 bg-gray-50/50 border border-gray-200 shadow-inner rounded-lg focus:bg-white focus:border-blue-200 focus:ring-0 outline-none resize-none transition-all" /><Edit3 className="absolute right-2 top-2 w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" /></div></td>
      <td className="px-4 py-4"><span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border shadow-sm ${isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>{item.status || 'Pending'}</span></td>
      <td className="px-4 py-4 text-right"><div className="flex items-center justify-end gap-1.5"><button onClick={() => onUpdateStatus(item.id, 'Completed')} title="Mark Completed" className="w-8 h-8 rounded-lg bg-white border border-gray-200 shadow-sm text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 flex items-center justify-center transition"><Check className="w-3.5 h-3.5" /></button><button onClick={() => onDelete(item.id)} title="Delete" className="w-8 h-8 rounded-lg bg-white border border-gray-200 shadow-sm text-red-500 hover:bg-red-50 hover:border-red-300 flex items-center justify-center transition"><Trash2 className="w-3.5 h-3.5" /></button></div></td>
    </tr>
  );
}
