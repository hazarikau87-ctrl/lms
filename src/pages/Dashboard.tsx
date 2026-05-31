import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FlaskConical, LogOut, Search, CalendarCheck, Clock, CheckCheck,
  RotateCw, ChevronLeft, ChevronRight, Building2, FileDown, Trash2, X, Settings as SettingsIcon, LayoutDashboard, MapPin, Beaker, BellRing, Check
} from 'lucide-react';
import { supabase, Appointment, Lab } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Settings from './settings';
import RescheduleDrawer from './RescheduleDrawer';
import ActionBar from './ActionBar';
import BookingTable from './BookingTable';

const RECORDS_PER_PAGE = 10;

const WA_TEMPLATES: Record<string, string> = {
  welcome: 'Hello [NAME], thank you for choosing our lab. Your appointment is confirmed for [DATE] at [TIME].',
  report: 'Hello [NAME], your lab reports for [TEST] are now ready. Please visit our portal to download.',
  reminder: 'Reminder: [NAME], you have an appointment on ([DATE]) at [TIME]. Please remember to fast if required.',
};

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<'dashboard' | 'settings'>('dashboard');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [lab, setLab] = useState<Lab | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Filters state
  const [selectedDate, setSelectedDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all'); 

  // Range-based date states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Address & Investigations Modals
  const [selectedAddressItem, setSelectedAddressItem] = useState<Appointment | null>(null);
  const [selectedTestItem, setSelectedTestItem] = useState<Appointment | null>(null);

  // TRACK ACTIVE APPOINTMENT ASSIGNED FOR RESCHEDULING
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

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

  // Local Timezone Safe date generation
  const checkReminderEligibility = useCallback((item: Appointment) => {
    if (item.status === 'Completed' || item.status === 'Cancelled') return false;
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    if (item.appointment_date !== todayStr) return false;
    if (!item.time) return false;

    try {
      const [hours, minutes] = item.time.split(':').map(Number);
      const apptTime = new Date();
      apptTime.setHours(hours, minutes, 0, 0);

      const now = new Date();
      const diffInMs = apptTime.getTime() - now.getTime();
      const diffInHours = diffInMs / (1000 * 60 * 60);

      return diffInHours >= 2.5 && diffInHours <= 3.5;
    } catch (e) {
      return false;
    }
  }, []);

  const stats = useMemo(() => {
    let baseList = appointments;
    if (selectedDate) {
      baseList = baseList.filter(a => a.appointment_date === selectedDate);
    }
    return {
      total: baseList.length,
      pending: baseList.filter(a => a.status !== 'Completed' && a.status !== 'Cancelled').length,
      completed: baseList.filter(a => a.status === 'Completed').length,
      reminders: baseList.filter(a => checkReminderEligibility(a)).length,
    };
  }, [appointments, selectedDate, checkReminderEligibility]);

  const filtered = useMemo(() => {
    let result = appointments;
    
    if (selectedDate) {
      result = result.filter(a => a.appointment_date === selectedDate);
    }

    if (statusFilter === 'pending') {
      result = result.filter(a => a.status !== 'Completed' && a.status !== 'Cancelled');
    } else if (statusFilter === 'completed') {
      result = result.filter(a => a.status === 'Completed');
    } else if (statusFilter === 'reminders') {
      result = result.filter(a => checkReminderEligibility(a));
    }

    const q = search.trim().toUpperCase();
    if (q) {
      result = result.filter(a =>
        a.name?.toUpperCase().includes(q) || a.booking_id?.toUpperCase().includes(q)
      );
    }
    return result;
  }, [appointments, search, selectedDate, statusFilter, checkReminderEligibility]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / RECORDS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * RECORDS_PER_PAGE, currentPage * RECORDS_PER_PAGE);

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

  const handleStatusFilterClick = (type: string) => {
    setCurrentPage(1);
    clearSelection();
    setStatusFilter(prev => prev === type ? 'all' : type);
  };

  const updateStatus = async (id: number, status: string) => {
    if (!lab?.id) return;
    try {
      await supabase.from('appointments').update({ status }).eq('id', id).eq('lab_id', lab.id);
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const updateRemarks = async (id: number, remarks: string) => {
    if (!lab?.id) return;
    try {
      await supabase.from('appointments').update({ remarks }).eq('id', id).eq('lab_id', lab.id);
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, remarks } : a));
    } catch (err) {
      console.error("Error updating remarks:", err);
    }
  };

  const deleteBooking = async (id: number) => {
    if (!confirm('Move this record to trash?') || !lab?.id) return;
    try {
      await supabase
        .from('appointments')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('lab_id', lab.id);
      fetchAll();
    } catch (err) {
      console.error("Error deleting booking:", err);
    }
  };

  const bulkUpdateStatus = async (status: string) => {
    if (!confirm(`Update ${selectedIds.size} item(s) to ${status}?`) || !lab?.id) return;
    try {
      await supabase.from('appointments').update({ status }).in('id', Array.from(selectedIds)).eq('lab_id', lab.id);
      clearSelection();
      fetchAll();
    } catch (err) {
      console.error("Bulk update failure:", err);
    }
  };

  const bulkDelete = async () => {
    if (!confirm(`Move ${selectedIds.size} record(s) to trash?`) || !lab?.id) return;
    try {
      await supabase.from('appointments').update({ is_deleted: true, deleted_at: new Date().toISOString() }).in('id', Array.from(selectedIds)).eq('lab_id', lab.id);
      clearSelection();
      fetchAll();
    } catch (err) {
      console.error("Bulk delete failure:", err);
    }
  };

  const deleteByRange = async () => {
    if (!startDate || !endDate || !lab?.id) return alert("Please select both dates.");
    const toDelete = appointments.filter(a => a.appointment_date >= startDate && a.appointment_date <= endDate);
    if (toDelete.length === 0) return alert("No records found in this range.");
    if (!confirm(`Move all ${toDelete.length} records from ${startDate} to ${endDate} to trash?`)) return;
    
    try {
      const idsToDelete = toDelete.map(a => a.id);
      await supabase.from('appointments').update({ is_deleted: true, deleted_at: new Date().toISOString() }).in('id', idsToDelete).eq('lab_id', lab.id);
      setStartDate(''); setEndDate(''); setShowDatePicker(false);
      fetchAll();
    } catch (err) {
      console.error("Range deletion error:", err);
    }
  };

  const sendWhatsApp = (phone: string, type: string, item: any) => {
    const targetNumber = item.whatsapp || phone;
    if (!targetNumber) return;
    const clean = targetNumber.replace(/\D/g, '');
    
    let msg = `Hello ${item.name}, this is regarding your booking ${item.booking_id}.`;
    if (type !== 'default' && WA_TEMPLATES[type]) {
      msg = WA_TEMPLATES[type]
        .replace('[NAME]', item.name)
        .replace('[DATE]', item.appointment_date)
        .replace('[TIME]', item.time || 'your scheduled time')
        .replace('[TEST]', item.test);
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
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text('Generated via LabOps Scheduler by Zebnox', 14, 31);
    doc.setFontSize(9); doc.text(`Exported on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 14, 38);
    const rows = dataToExport.map(item => [item.booking_id, { content: `${item.name}\n${item.age ?? 'N/A'}Y / ${item.gender || ''}\n${item.mobile || 'N/A'}`, styles: { fontStyle: 'bold' as const } }, item.test, `${item.appointment_date}\n${item.time || 'N/A'}`, item.remarks || '-', { content: (item.status || 'Pending').toUpperCase(), styles: { textColor: item.status === 'Completed' ? [46, 125, 50] as [number, number, number] : item.status === 'Cancelled' ? [185, 28, 28] as [number, number, number] : [194, 65, 12] as [number, number, number], fontStyle: 'bold' as const } } ]);
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

  const parsedTests = useMemo(() => {
    if (!selectedTestItem?.test) return [];
    return selectedTestItem.test.split(',').map((t: string) => t.trim()).filter(Boolean);
  }, [selectedTestItem]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-500 selection:text-white antialiased">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-6 py-4 mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm shadow-blue-600/10 flex-shrink-0">
                <FlaskConical className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-slate-900">LabOps Scheduler</h1>
                <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Powered by Zebnox</p>
              </div>
            </div>

            <div className="w-px h-8 bg-slate-200 hidden sm:block" />

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 rounded-full px-3 py-1">
              <div className="w-5 h-5 rounded-full border border-slate-200 bg-white overflow-hidden flex items-center justify-center flex-shrink-0">
                {lab?.logo_url ? (
                  <img src={lab.logo_url} alt="lab logo" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-3 text-slate-400" />
                )}
              </div>
              <span className="text-xs font-semibold text-slate-700">
                {loading ? 'Loading...' : (lab?.lab_name || 'Partner Lab')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentView === 'dashboard' ? (
              <button onClick={() => setCurrentView('settings')} className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
                <SettingsIcon className="w-3.5 h-3.5" /> Settings
              </button>
            ) : (
              <button onClick={() => setCurrentView('dashboard')} className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
                <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
              </button>
            )}

            {currentView === 'dashboard' && (
              <>
                <div className="relative flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                  <CalendarCheck className="w-3.5 h-3.5 text-slate-400" />
                  <input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setCurrentPage(1); }} className="bg-transparent border-none text-xs font-medium text-slate-700 focus:ring-0 p-0 outline-none cursor-pointer" />
                  {selectedDate && (
                    <button onClick={() => { setSelectedDate(''); setCurrentPage(1); }} className="p-0.5 hover:bg-slate-200 rounded-full">
                      <X className="w-3 h-3 text-slate-400" />
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input type="text" value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="Search ID or patient..." className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-48 transition" />
                </div>
              </>
            )}
            
            <button onClick={signOut} className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-red-200 bg-white text-xs font-semibold text-red-600 hover:bg-red-50/60 transition">
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>

        {currentView === 'settings' ? (
          <div className="animate-[fadeIn_0.2s_ease]"><Settings /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard 
                icon={<CalendarCheck className="w-4 h-4 text-blue-600" />} 
                iconBg="bg-blue-50" 
                value={stats.total} 
                label={selectedDate ? `Booked on ${selectedDate}` : "Total Bookings"} 
                isActive={statusFilter === 'all'}
                onClick={() => handleStatusFilterClick('all')}
              />
              <StatCard 
                icon={<Clock className="w-4 h-4 text-amber-600" />} 
                iconBg="bg-amber-50" 
                value={stats.pending} 
                label="Pending Requests" 
                isActive={statusFilter === 'pending'}
                onClick={() => handleStatusFilterClick('pending')}
              />
              <StatCard 
                icon={<CheckCheck className="w-4 h-4 text-emerald-600" />} 
                iconBg="bg-emerald-50" 
                value={stats.completed} 
                label="Completed Tests" 
                isActive={statusFilter === 'completed'}
                onClick={() => handleStatusFilterClick('completed')}
              />
              <StatCard 
                icon={<BellRing className={`w-4 h-4 ${stats.reminders > 0 ? 'text-orange-600 animate-[pulse_2s_infinite]' : 'text-slate-400'}`} />} 
                iconBg={stats.reminders > 0 ? 'bg-orange-50' : 'bg-slate-100'} 
                value={stats.reminders} 
                label="Due for Reminder (2.5h)" 
                isActive={statusFilter === 'reminders'}
                onClick={() => handleStatusFilterClick('reminders')}
              />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <div className="flex items-center h-5">
                    <input type="checkbox" checked={isAllPageSelected} onChange={e => toggleSelectAll(e.target.checked)} className="w-4 h-4 border-slate-300 rounded text-blue-600 focus:ring-blue-500/20 cursor-pointer" />
                  </div>
                  <label className="text-xs font-semibold text-slate-500 select-none">Select Page Records</label>
                  
                  {statusFilter !== 'all' && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1 ml-2 capitalize">
                      {statusFilter === 'reminders' ? 'Due for Reminder' : statusFilter}
                      <button onClick={() => setStatusFilter('all')} className="hover:text-blue-900 ml-0.5 font-bold">×</button>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={fetchAll} title="Refresh data" className={`flex items-center justify-center p-2 text-slate-500 border border-slate-200 bg-white rounded-xl hover:bg-slate-50 transition ${loading ? 'opacity-50' : ''}`} disabled={loading}>
                    <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>

                  <div className="relative">
                    {!showDatePicker ? (
                      <button onClick={() => setShowDatePicker(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 bg-white rounded-xl hover:bg-slate-50 transition">
                        <CalendarCheck className="w-3.5 h-3.5 text-slate-400" /> Range Report
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-xl shadow-sm z-10">
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-xs border-none bg-slate-50 rounded-lg focus:ring-0 text-slate-700 p-1.5" />
                        <span className="text-[10px] text-slate-400 font-bold">TO</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-xs border-none bg-slate-50 rounded-lg focus:ring-0 text-slate-700 p-1.5" />
                        {startDate && endDate && (
                          <div className="flex items-center border-l border-slate-200 pl-1 gap-0.5">
                            <button onClick={exportByRange} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"><FileDown className="w-3.5 h-3.5" /></button>
                            <button onClick={deleteByRange} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                        <button onClick={() => { setShowDatePicker(false); setStartDate(''); setEndDate(''); }} className="p-1.5 text-slate-400 hover:text-slate-600 border-l border-slate-200 ml-1"><Check className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>
                  <button onClick={exportToPDF} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 bg-white rounded-xl hover:bg-slate-50 transition">
                    <FileDown className="w-3.5 h-3.5 text-slate-400" /> Export All PDF
                  </button>
                </div>
              </div>

              <BookingTable 
                loading={loading}
                paginated={paginated}
                selectedIds={selectedIds}
                toggleRow={toggleRow}
                onUpdateStatus={updateStatus}
                onUpdateRemarks={updateRemarks}
                onDelete={deleteBooking}
                onWhatsApp={sendWhatsApp}
                onViewAddress={setSelectedAddressItem}
                onViewTests={setSelectedTestItem}
                onSelectReschedule={setEditingAppointment}
                checkReminderEligibility={checkReminderEligibility}
              />

              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs font-medium text-slate-500">Showing rows {Math.min(filtered.length, (currentPage - 1) * RECORDS_PER_PAGE + 1)}-{Math.min(filtered.length, currentPage * RECORDS_PER_PAGE)} of {filtered.length}</p>
                <div className="flex items-center gap-2">
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"><ChevronLeft className="w-4 h-4" /> Prev</button>
                  <span className="text-xs font-bold text-slate-700 px-2">Page {currentPage} of {totalPages}</span>
                  <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition">Next <ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* DYNAMIC VIEW ADDRESS PORTAL WINDOW */}
      {selectedAddressItem && (
        <div onClick={() => setSelectedAddressItem(null)} className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-[fadeIn_0.1s_ease-out]">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden animate-[scaleUp_0.1s_ease-out]">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2 text-slate-800">
                <MapPin className="w-4 h-4 text-blue-500" />
                <h3 className="font-bold text-sm">Logistics Address Details</h3>
              </div>
              <button onClick={() => setSelectedAddressItem(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">Patient Account</span>
                <p className="text-sm font-semibold text-slate-900">{selectedAddressItem.name}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">ID Mapping</span>
                <p className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded inline-block">{selectedAddressItem.booking_id}</p>
              </div>
              <hr className="border-slate-100" />
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Destination Address</span>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 font-medium">
                  {selectedAddressItem.address || 'No location schema configuration detected.'}
                </p>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button onClick={() => setSelectedAddressItem(null)} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl text-xs transition">Dismiss Modal</button>
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC VIEW INVESTIGATIONS PORTAL WINDOW */}
      {selectedTestItem && (
        <div onClick={() => setSelectedTestItem(null)} className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-[fadeIn_0.1s_ease-out]">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden animate-[scaleUp_0.1s_ease-out]">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2 text-slate-800">
                <Beaker className="w-4 h-4 text-blue-500" />
                <h3 className="font-bold text-sm">Selected Test Panels</h3>
              </div>
              <button onClick={() => setSelectedTestItem(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">Patient Profile</span>
                  <p className="text-sm font-semibold text-slate-900">{selectedTestItem.name}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">Booking ID</span>
                  <p className="text-xs font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded inline-block border border-blue-100">{selectedTestItem.booking_id}</p>
                </div>
              </div>
              <hr className="border-slate-100" />
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-2">Clinical Protocols ({parsedTests.length})</span>
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                  {parsedTests.length > 0 ? (
                    parsedTests.map((testName, idx) => (
                      <div key={idx} className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl">
                        <div className="w-5 h-5 rounded-md bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 shadow-sm">{idx + 1}</div>
                        <p className="text-xs font-semibold text-slate-700 truncate">{testName}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">No direct lab code definitions assigned.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button onClick={() => setSelectedTestItem(null)} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl text-xs transition">Close View</button>
            </div>
          </div>
        </div>
      )}

      <RescheduleDrawer 
        appointment={editingAppointment}
        labId={lab?.id}
        onClose={() => setEditingAppointment(null)}
        onSuccess={(updatedFields) => {
          setAppointments(prev => prev.map(appt => 
            appt.id === editingAppointment?.id ? { ...appt, ...updatedFields } : appt
          ));
        }}
      />

      <ActionBar 
        selectedIds={selectedIds}
        appointments={appointments}
        labName={lab?.lab_name}
        onClearSelection={clearSelection}
        onBulkUpdateStatus={bulkUpdateStatus}
        onBulkDelete={bulkDelete}
      />
    </div>
  );
}

function StatCard({ icon, iconBg, value, label, isActive, onClick }: { icon: React.ReactNode; iconBg: string; value: number; label: string; isActive?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`w-full text-left bg-white rounded-2xl border p-4 flex items-center gap-3.5 transition-all focus:outline-none ${isActive ? 'border-blue-500 shadow-sm shadow-blue-500/5 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300'}`}>
      <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>{icon}</div>
      <div>
        <p className="text-xl font-bold tracking-tight text-slate-900">{value}</p>
        <p className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">{label}</p>
      </div>
    </button>
  );
}
