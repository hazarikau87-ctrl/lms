import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FlaskConical, LogOut, Search, CalendarCheck, Clock, CheckCheck,
  Phone, FileText, Check, Trash2, ChevronLeft, ChevronRight,
  MessageCircle, Building2, FileDown, RotateCw, Edit3, X, Settings as SettingsIcon, LayoutDashboard, MapPin, Beaker, BellRing, ChevronDown, ChevronUp, Plus
} from 'lucide-react';
import { supabase, Appointment, Lab } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Settings from './settings';
import RescheduleDrawer from './RescheduleDrawer';
import ActionBar from './ActionBar';
import { SlidoverSettings } from './SlidoverSettings';
import { BookingRegistrationForm } from './BookingRegistrationForm';

const RECORDS_PER_PAGE = 10;

const WA_TEMPLATES: Record<string, string> = {
  welcome: 'Hello [NAME], thank you for choosing our lab. Your appointment is confirmed for [DATE] at [TIME].',
  report: 'Hello [NAME], your lab reports for [TEST] are now ready. Please visit our portal to download.',
  reminder: 'Reminder: [NAME], you have an appointment on ([DATE]) at [TIME]. Please remember to fast if required.',
};

interface AppointmentRowProps {
  item: Appointment & { [key: string]: any };
  selected: boolean;
  onToggle: () => void;
  onUpdateStatus: (id: number, status: string) => Promise<void>;
  onUpdateRemarks: (id: number, remarks: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onWhatsApp: (phone: string, type: string, item: any) => void;
  onViewAddress: (item: any) => void;
  onViewTests: (item: any) => void;
  onSelectReschedule: (item: any) => void;
  isInsideReminderWindow: boolean;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<'dashboard' | 'settings'>('dashboard');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [lab, setLab] = useState<Lab | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Registration Form Toggle Modal State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  // Filters state
  const [selectedDate, setSelectedDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all'); 

  // Range-based date states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Address & Investigations Modals
  const [selectedAddressItem, setSelectedAddressItem] = useState<any | null>(null);
  const [selectedTestItem, setSelectedTestItem] = useState<any | null>(null);

  // Track active appointment assigned for rescheduling
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

  const checkReminderEligibility = useCallback((item: Appointment) => {
    if (item.status === 'Completed' || item.status === 'Cancelled') return false;
    
    const todayStr = new Date().toISOString().split('T')[0];
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
    await supabase.from('appointments').update({ remarks }).eq('id', id).eq('lab_id', lab.id);
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, remarks } : a));
  };

  const deleteBooking = async (id: number) => {
    if (!confirm('Move this record to trash?') || !lab?.id) return;
    await supabase
      .from('appointments')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('lab_id', lab.id);
    fetchAll();
  };

  const bulkUpdateStatus = async (status: string) => {
    if (!confirm(`Update ${selectedIds.size} item(s) to ${status}?`) || !lab?.id) return;
    await supabase.from('appointments').update({ status }).in('id', Array.from(selectedIds)).eq('lab_id', lab.id);
    clearSelection();
    fetchAll();
  };

  const bulkDelete = async () => {
    if (!confirm(`Move ${selectedIds.size} record(s) to trash?`) || !lab?.id) return;
    await supabase.from('appointments').update({ is_deleted: true, deleted_at: new Date().toISOString() }).in('id', Array.from(selectedIds)).eq('lab_id', lab.id);
    clearSelection();
    fetchAll();
  };

  const deleteByRange = async () => {
    if (!startDate || !endDate || !lab?.id) return alert("Please select both dates.");
    const toDelete = appointments.filter(a => a.appointment_date >= startDate && a.appointment_date <= endDate);
    if (toDelete.length === 0) return alert("No records found in this range.");
    if (!confirm(`Move all ${toDelete.length} records from ${startDate} to ${endDate} to trash?`)) return;
    const idsToDelete = toDelete.map(a => a.id);
    await supabase.from('appointments').update({ is_deleted: true, deleted_at: new Date().toISOString() }).in('id', idsToDelete).eq('lab_id', lab.id);
    setStartDate(''); setEndDate(''); setShowDatePicker(false);
    fetchAll();
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
    const rows = dataToExport.map(item => [item.booking_id, { content: `${item.name}\n${item.age ?? 'N/A'}Y / ${item.gender || ''}\n${item.mobile || 'N/A'}`, styles: { fontStyle: 'bold' as const } }, item.test, `${item.appointment_date}\n${item.time || 'N/A'}`, item.remarks || '-', { content: (item.status || 'Pending').toUpperCase(), styles: { textColor: item.status === 'Completed' ? [46, 125, 50] as [number, number, number] : item.status === 'Cancelled' ? [185, 28, 28] as [number, number, number] : [194, 65, 12] as [number, number, number], fontStyle: 'bold' as const } }]);
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

  // FIXED: Handler now only refreshes data - the form already saved to database
  const handleRegistrationSuccess = async (newAppointment: any) => {
    // Close the registration drawer
    setIsRegisterOpen(false);
    // Refresh the appointments list to show the newly created record
    await fetchAll();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-500 selection:text-white antialiased relative">
      {/* SlidoverSettings Sidebar */}
      <SlidoverSettings 
        currentLab={lab?.lab_name || "City Diagnostic"}
        currentView={currentView}
        setCurrentView={setCurrentView}
      />

      {/* Main Content - adjusted margin to accommodate sidebar */}
      <div className="ml-16 transition-all duration-300">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">

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
              {currentView === 'dashboard' && (
                <>
                  {/* UX Addition: Primary Interactive Form Opener Call to Action */}
                  <button 
                    onClick={() => setIsRegisterOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-600/10 transition-all"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" /> New Registration
                  </button>

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
              {/* Clickable Stats */}
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

              {/* Premium Table Component Layout */}
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

                <div className="overflow-x-auto">
                  <table className="w-full min-w-full table-auto">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/40 text-slate-400">
                        <th className="w-16 px-6 py-3"></th>
                        <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Booking ID</th>
                        <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Patient Details</th>
                        <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Diagnostics / Schedule</th>
                        <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider w-64">Internal Remarks & Logs</th>
                        <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Status</th>
                        <th className="pr-6 pl-4 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {loading ? (
                        <tr><td colSpan={7} className="py-24 text-center"><RotateCw className="w-6 h-6 animate-spin mx-auto text-blue-500" /></td></tr>
                      ) : paginated.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-24 text-center text-slate-400">
                            <div className="flex flex-col items-center gap-2 max-w-sm mx-auto">
                              <Search className="w-8 h-8 text-slate-300 mb-1" />
                              <p className="text-sm font-semibold text-slate-800">No matching appointments</p>
                              <p className="text-xs text-slate-400">Try updating your parameters or filters.</p>
                            </div>
                          </td>
                        </tr>
                      ) : paginated.map(item => (
                        <AppointmentRow 
                          key={item.id} 
                          item={item} 
                          selected={selectedIds.has(item.id)} 
                          onToggle={() => toggleRow(item.id)} 
                          onUpdateStatus={updateStatus} 
                          onUpdateRemarks={updateRemarks} 
                          onDelete={deleteBooking} 
                          onWhatsApp={sendWhatsApp} 
                          onViewAddress={setSelectedAddressItem}
                          onViewTests={setSelectedTestItem}
                          onSelectReschedule={setEditingAppointment}
                          isInsideReminderWindow={checkReminderEligibility(item)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

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
      </div>

      {/* UX SLIDE-OVER RIGHT PORTAL: NEW PATIENT REGISTRATION DRAWER */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-xs animate-[fadeIn_0.15s_ease-out]">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <div className="pointer-events-auto w-screen max-w-3xl transform transition-transform duration-300 ease-in-out">
                <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-2xl border-l border-slate-200/80 custom-scrollbar">
                  <div className="px-6 pt-5 pb-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                      </div>
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Workspace Flow Manager</span>
                    </div>
                    <button 
                      onClick={() => setIsRegisterOpen(false)}
                      className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-50 shadow-2xs transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="relative flex-1 py-6 px-4 sm:px-6">
                    <BookingRegistrationForm 
                      currentLabId={lab?.id ? String(lab.id) : "LAB-001"}
                      onCancel={() => setIsRegisterOpen(false)}
                      onSuccess={handleRegistrationSuccess}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  {selectedAddressItem.address_line || selectedAddressItem.address || 'No location schema configuration detected.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">Postal Zip Code</span>
                  <p className="text-xs font-semibold text-slate-900">{selectedAddressItem.pincode || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">Identified Landmark</span>
                  <p className="text-xs font-semibold text-slate-900">{selectedAddressItem.landmark || 'None Provided'}</p>
                </div>
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

function AppointmentRow({ item, selected, onToggle, onUpdateStatus, onUpdateRemarks, onDelete, onWhatsApp, onViewAddress, onViewTests, onSelectReschedule, isInsideReminderWindow }: AppointmentRowProps) {
  const isCompleted = item.status === 'Completed';
  const isCancelled = item.status === 'Cancelled';
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [localRemarks, setLocalRemarks] = useState(item.remarks || '');
  const [isFocused, setIsFocused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedCheck, setShowSavedCheck] = useState(false);
  
  useEffect(() => { setLocalRemarks(item.remarks || ''); }, [item.remarks]);
  
  const handleRemarksBlur = async () => { 
    setIsFocused(false);
    if (localRemarks !== (item.remarks || '')) { 
      try {
        setIsSaving(true);
        await onUpdateRemarks(item.id, localRemarks);
        setIsSaving(false);
        setShowSavedCheck(true);
        setTimeout(() => setShowSavedCheck(false), 2000);
      } catch (err) {
        setIsSaving(false);
        console.error("Failed to commit log update:", err);
      }
    } 
  };

  const isHomeCollection = item.bookingType === 'home' || item.booking_type === 'home' || item.booking_type === 'Home Collection';

  const totalTestCount = useMemo(() => {
    if (!item.test) return 0;
    return item.test.split(',').map((t: string) => t.trim()).filter(Boolean).length;
  }, [item.test]);

  return (
    <>
      <tr className={`hover:bg-slate-50/40 transition-colors ${selected ? 'bg-blue-50/20' : ''} ${isExpanded ? 'bg-slate-50/80' : ''}`}>
        <td className="px-6 py-3.5 text-center">
          <div className="flex items-center justify-center gap-2">
            <button 
              type="button" 
              onClick={() => setIsExpanded(!isExpanded)} 
              className="p-1 rounded-lg hover:bg-slate-200/80 text-slate-500 transition"
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <input type="checkbox" checked={selected} onChange={onToggle} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/10 cursor-pointer" />
          </div>
        </td>
        
        <td className="px-4 py-3.5 whitespace-nowrap">
          <button 
            type="button"
            onClick={() => onSelectReschedule(item)}
            className="font-mono text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline bg-blue-50/60 hover:bg-blue-50 border border-blue-100/80 px-2 py-1 rounded-lg shadow-2xs transition-all text-left"
          >
            {item.booking_id}
          </button>
        </td>

        <td className="px-4 py-3.5">
          <div className="max-w-[200px]">
            <p className="font-semibold text-slate-900 text-xs truncate" title={item.name}>{item.name}</p>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">{item.age ?? 'N/A'}Y &bull; {item.gender || 'N/A'}</p>
          </div>
        </td>
        
        <td className="px-4 py-3.5">
          <div>
            <button type="button" onClick={() => onViewTests(item)} className="text-left group inline-flex items-center text-[11px] font-bold text-blue-600 hover:text-blue-700 transition">
              <Beaker className="w-3 h-3 text-blue-500 mr-1 flex-shrink-0" /> 
              <span className="truncate max-w-[150px]">Investigations {totalTestCount > 0 ? `(${totalTestCount})` : ''}</span>
            </button>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-[10px] font-semibold text-slate-400 tracking-tight">{item.appointment_date} &bull; {item.time || 'N/A'}</p>
              {isInsideReminderWindow && (
                <span className="flex h-2 w-2 relative" title="Due for pre-test reminder execution">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                </span>
              )}
            </div>
          </div>
        </td>

        <td className="px-4 py-3.5">
          <div className="relative group w-full max-w-[240px]">
            <textarea 
              value={localRemarks} 
              onChange={(e) => setLocalRemarks(e.target.value)} 
              onFocus={() => setIsFocused(true)} 
              onBlur={handleRemarksBlur} 
              placeholder="Add log entry..." 
              rows={1} 
              disabled={isSaving} 
              className="w-full text-[11px] font-medium p-1.5 bg-slate-50 border border-slate-200 focus:border-blue-400 focus:bg-white rounded-lg outline-none resize-none transition-all custom-scrollbar" 
            />
            <div className="absolute right-2 top-2.5 flex items-center gap-1 pointer-events-none select-none">
              {isSaving && <RotateCw className="w-2.5 h-2.5 text-blue-500 animate-spin" />}
              {showSavedCheck && (
                <div className="flex items-center gap-0.5 px-1 rounded bg-emerald-50 text-emerald-600 border border-emerald-200/60 font-bold text-[8px] uppercase tracking-wider">
                  <Check className="w-2 h-2 stroke-[3]" /> Saved
                </div>
              )}
              {!isSaving && !showSavedCheck && <Edit3 className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </div>
          </div>
        </td>

        <td className="px-4 py-3.5 whitespace-nowrap">
          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase border ${isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : isCancelled ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
            {item.status || 'Pending'}
          </span>
        </td>
        <td className="pr-6 pl-4 py-3.5 text-right whitespace-nowrap">
          <div className="flex items-center justify-end gap-1">
            <button onClick={() => onUpdateStatus(item.id, 'Completed')} title="Mark Completed" className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-emerald-600 hover:border-emerald-200 flex items-center justify-center transition shadow-sm"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => onUpdateStatus(item.id, 'Cancelled')} title="Cancel Workflow" className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-rose-600 hover:border-rose-200 flex items-center justify-center transition shadow-sm"><X className="w-3.5 h-3.5" /></button>
            <button onClick={() => onDelete(item.id)} title="Trash Record" className="w-7 h-7 rounded-lg border border-transparent bg-transparent text-slate-400 hover:text-rose-600 flex items-center justify-center transition"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </td>
      </tr>

      {/* EXPANDED INNER PANEL ACCORDION */}
      {isExpanded && (
        <tr className="bg-slate-50/50">
          <td colSpan={7} className="px-8 py-5 border-t border-b border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-600">
              
              {/* Prescription */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-2.5">Prescription Doc</span>
                {item.prescription_url ? ( 
                  <a href={item.prescription_url.startsWith('http') ? item.prescription_url : supabase.storage.from('prescriptions').getPublicUrl(item.prescription_url).data.publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-150 rounded-lg font-semibold text-blue-700 transition">
                    <FileText className="w-3.5 h-3.5" /> View Prescription (Rx)
                  </a> 
                ) : (
                  <span className="text-slate-400 font-medium italic block py-1">No file attached</span>
                )}
              </div>

              {/* Contact Profiles */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-2">Contact Profile</span>
                <div className="space-y-2">
                  <a href={`tel:${item.mobile}`} className="inline-flex items-center gap-1.5 font-bold text-slate-700 hover:text-blue-600 transition">
                    <Phone className="w-3 h-3 text-slate-400" /> {item.mobile}
                  </a>
                  <div className="flex items-center gap-2">
                    <select defaultValue="" onChange={e => { onWhatsApp(item.mobile, e.target.value, item); e.target.value = ''; }} className="text-[11px] font-medium px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 cursor-pointer focus:outline-none">
                      <option value="">Send Alert</option>
                      <option value="welcome">Welcome</option>
                      <option value="report">Ready</option>
                      <option value="reminder">Remind</option>
                    </select>
                    <button onClick={() => onWhatsApp(item.mobile, 'default', item)} className="inline-flex items-center px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-lg font-bold transition">
                      <MessageCircle className="w-3.5 h-3.5 mr-1" /> Chat
                    </button>
                  </div>
                </div>
              </div>

              {/* Fulfillment Matrix */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-2.5">Fulfillment Target</span>
                {isHomeCollection ? (
                  <button type="button" onClick={() => onViewAddress(item)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-semibold transition">
                    <MapPin className="w-3.5 h-3.5 text-amber-600" /> View Map Address
                  </button>
                ) : (
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200/60 px-2 py-1 rounded-md tracking-wide uppercase inline-block">Walk-in Appointment</span>
                )}
              </div>

            </div>
          </td>
        </tr>
      )}
    </>
  );
}
