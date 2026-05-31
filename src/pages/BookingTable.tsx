import { useState, useMemo, useEffect } from 'react';
import { 
  FileText, Phone, MessageCircle, Beaker, MapPin, 
  Edit3, RotateCw, Check, X, Trash2, ChevronDown, ChevronUp 
} from 'lucide-react';
import { Appointment } from '../lib/supabase';

interface BookingTableProps {
  loading: boolean;
  paginated: any[];
  selectedIds: Set<number>;
  toggleRow: (id: number) => void;
  onUpdateStatus: (id: number, status: string) => Promise<void>;
  onUpdateRemarks: (id: number, remarks: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onWhatsApp: (phone: string, type: string, item: any) => void;
  onViewAddress: (item: any) => void;
  onViewTests: (item: any) => void;
  onSelectReschedule: (item: any) => void;
  checkReminderEligibility: (item: any) => boolean;
}

export default function BookingTable({
  loading,
  paginated,
  selectedIds,
  toggleRow,
  onUpdateStatus,
  onUpdateRemarks,
  onDelete,
  onWhatsApp,
  onViewAddress,
  onViewTests,
  onSelectReschedule,
  checkReminderEligibility,
}: BookingTableProps) {
  // Track open expanded rows for additional metrics (Remarks, Address metadata)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRowExpansion = (id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <RotateCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
      </div>
    );
  }

  if (paginated.length === 0) {
    return (
      <div className="py-24 text-center text-slate-400">
        <div className="flex flex-col items-center gap-2 max-w-sm mx-auto">
          <p className="text-sm font-semibold text-slate-800">No matching appointments</p>
          <p className="text-xs text-slate-400">Try updating your parameters or filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* 🖥️ DESKTOP MODE: Elegant, high-density presentation matrix (Hidden on mobile) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/40 text-slate-400">
              <th className="w-12 px-4 py-3.5 text-center"></th>
              <th className="w-32 px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Booking ID</th>
              <th className="w-52 px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Patient Details</th>
              <th className="w-28 px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Prescription</th>
              <th className="w-44 px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Contact Profile</th>
              <th className="w-52 px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Diagnostics / Schedule</th>
              <th className="w-28 px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider">Status</th>
              <th className="w-32 pr-6 pl-4 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider">Actions</th>
              <th className="w-12 px-4 py-3.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {paginated.map((item) => (
              <DesktopRow
                key={item.id}
                item={item}
                selected={selectedIds.has(item.id)}
                isExpanded={expandedRows.has(item.id)}
                onToggle={() => toggleRow(item.id)}
                onToggleExpand={() => toggleRowExpansion(item.id)}
                onUpdateStatus={onUpdateStatus}
                onUpdateRemarks={onUpdateRemarks}
                onDelete={onDelete}
                onWhatsApp={onWhatsApp}
                onViewAddress={onViewAddress}
                onViewTests={onViewTests}
                onSelectReschedule={onSelectReschedule}
                isInsideReminderWindow={checkReminderEligibility(item)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* 📱 MOBILE RESPONSIVE MODE: Flawless UI Card Transformations (Hidden on Desktop) */}
      <div className="md:hidden divide-y divide-slate-100 p-4 space-y-4">
        {paginated.map((item) => (
          <MobileCard
            key={item.id}
            item={item}
            selected={selectedIds.has(item.id)}
            onToggle={() => toggleRow(item.id)}
            onUpdateStatus={onUpdateStatus}
            onUpdateRemarks={onUpdateRemarks}
            onDelete={onDelete}
            onWhatsApp={onWhatsApp}
            onViewAddress={onViewAddress}
            onViewTests={onViewTests}
            onSelectReschedule={onSelectReschedule}
            isInsideReminderWindow={checkReminderEligibility(item)}
          />
        ))}
      </div>
    </div>
  );
}

/* ==========================================================================
   DESKTOP VIEW IMPLEMENTATION COMPONENTS
   ========================================================================== */
function DesktopRow({
  item, selected, isExpanded, onToggle, onToggleExpand, onUpdateStatus, 
  onUpdateRemarks, onDelete, onWhatsApp, onViewAddress, onViewTests, 
  onSelectReschedule, isInsideReminderWindow
}: any) {
  const isCompleted = item.status === 'Completed';
  const isCancelled = item.status === 'Cancelled';
  const isHomeCollection = item.bookingType === 'home' || item.booking_type === 'home';

  const totalTestCount = useMemo(() => {
    if (!item.test) return 0;
    return item.test.split(',').map((t: string) => t.trim()).filter(Boolean).length;
  }, [item.test]);

  return (
    <>
      <tr className={`hover:bg-slate-50/30 transition-colors ${selected ? 'bg-blue-50/20' : ''}`}>
        <td className="px-4 py-3.5 text-center">
          <input type="checkbox" checked={selected} onChange={onToggle} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/10 cursor-pointer" />
        </td>
        
        <td className="px-4 py-3.5 min-w-0">
          <button type="button" onClick={() => onSelectReschedule(item)} className="font-mono text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline bg-blue-50/60 hover:bg-blue-50 border border-blue-100/80 px-2 py-1 rounded-lg transition-all text-left block truncate">
            {item.booking_id}
          </button>
        </td>

        <td className="px-4 py-3.5">
          <div className="max-w-[180px]">
            <p className="font-semibold text-slate-900 text-xs truncate" title={item.name}>{item.name}</p>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">{item.age ?? 'N/A'}Y &bull; {item.gender || 'N/A'}</p>
          </div>
        </td>

        <td className="px-4 py-3.5">
          {item.prescription_url ? ( 
            <a href={item.prescription_url.startsWith('http') ? item.prescription_url : '#'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-600 transition">
              <FileText className="w-3 h-3 text-slate-400" /> Rx
            </a> 
          ) : (
            <span className="text-[11px] text-slate-400 font-medium italic">None</span>
          )}
        </td>

        <td className="px-4 py-3.5">
          <div className="space-y-0.5">
            <a href={`tel:${item.mobile}`} className="inline-flex items-center gap-1 text-[11px] text-slate-600 font-bold hover:text-blue-600 transition">
              <Phone className="w-2.5 h-2.5 text-slate-400" /> {item.mobile}
            </a>
            <div className="flex items-center gap-1.5">
              <select defaultValue="" onChange={e => { onWhatsApp(item.mobile, e.target.value, item); e.target.value = ''; }} className="text-[10px] font-medium px-1 py-0.5 rounded-md border border-slate-200 bg-white text-slate-500 max-w-[70px] cursor-pointer focus:outline-none">
                <option value="">Alerts</option>
                <option value="welcome">Welcome</option>
                <option value="report">Ready</option>
                <option value="reminder">Remind</option>
              </select>
              <button onClick={() => onWhatsApp(item.mobile, 'default', item)} className="inline-flex items-center text-[10px] font-bold text-emerald-600 hover:text-emerald-700 transition">
                <MessageCircle className="w-3 h-3 mr-0.5" /> Chat
              </button>
            </div>
          </div>
        </td>
        
        <td className="px-4 py-3.5">
          <div>
            <button type="button" onClick={() => onViewTests(item)} className="text-left group inline-flex items-center text-[11px] font-bold text-blue-600 hover:text-blue-700 transition">
              <Beaker className="w-3 h-3 text-blue-500 mr-1 flex-shrink-0" /> 
              <span className="truncate max-w-[130px]">Tests {totalTestCount > 0 ? `(${totalTestCount})` : ''}</span>
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
          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase border ${isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : isCancelled ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
            {item.status || 'Pending'}
          </span>
        </td>

        <td className="pr-6 pl-4 py-3.5 text-right">
          <div className="flex items-center justify-end gap-1">
            <button onClick={() => onUpdateStatus(item.id, 'Completed')} title="Mark Completed" className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-emerald-600 hover:border-emerald-200 flex items-center justify-center transition shadow-sm"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => onUpdateStatus(item.id, 'Cancelled')} title="Cancel Workflow" className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-rose-600 hover:border-rose-200 flex items-center justify-center transition shadow-sm"><X className="w-3.5 h-3.5" /></button>
            <button onClick={() => onDelete(item.id)} title="Trash Record" className="w-7 h-7 rounded-lg border border-transparent bg-transparent text-slate-400 hover:text-rose-600 flex items-center justify-center transition"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </td>

        <td className="px-4 py-3.5 text-center">
          <button type="button" onClick={onToggleExpand} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition" title="Show details & Remarks">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </td>
      </tr>

      {/* 📦 PROGRESSIVE DISCLOSURE COLLAPSIBLE PANEL */}
      {isExpanded && (
        <tr className="bg-slate-50/40 border-b border-slate-100 animate-[fadeIn_0.15s_ease-out]">
          <td colSpan={9} className="px-8 py-3.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              {/* Address Parameters Panel */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-blue-500" /> Fulfillment Address Profile
                </span>
                {isHomeCollection ? (
                  <div className="flex items-start gap-2">
                    <p className="text-xs text-slate-600 bg-white border border-slate-200 p-2.5 rounded-xl shadow-2xs font-medium leading-relaxed max-w-md">
                      {item.address_line || item.address || 'No location schema configuration detected.'}
                    </p>
                    <button type="button" onClick={() => onViewAddress(item)} className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 text-[10px] font-bold rounded-lg transition shrink-0 border border-blue-100 mt-1">Full View</button>
                  </div>
                ) : (
                  <span className="text-[10px] w-fit font-bold text-slate-500 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded-md uppercase tracking-wide">Walk-in Patient</span>
                )}
              </div>

              {/* Internal Remarks Interactive Logger Area */}
              <InternalRemarksLogger item={item} onUpdateRemarks={onUpdateRemarks} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ==========================================================================
   MOBILE VIEW CARD ARCHITECTURE
   ========================================================================== */
function MobileCard({
  item, selected, onToggle, onUpdateStatus, onUpdateRemarks, onDelete, 
  onWhatsApp, onViewAddress, onViewTests, onSelectReschedule, isInsideReminderWindow
}: any) {
  const isCompleted = item.status === 'Completed';
  const isCancelled = item.status === 'Cancelled';
  const isHomeCollection = item.bookingType === 'home' || item.booking_type === 'home';

  return (
    <div className={`bg-white rounded-2xl border p-4 space-y-3 shadow-xs transition-all relative ${selected ? 'border-blue-300 ring-2 ring-blue-500/5' : 'border-slate-200'}`}>
      
      {/* Top Header Row of the Card */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2.5">
          <input type="checkbox" checked={selected} onChange={onToggle} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/10 cursor-pointer" />
          <button type="button" onClick={() => onSelectReschedule(item)} className="font-mono text-xs font-bold text-blue-600 bg-blue-50/60 px-2 py-0.5 rounded-lg border border-blue-100/50">
            {item.booking_id}
          </button>
        </div>
        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase border ${isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : isCancelled ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
          {item.status || 'Pending'}
        </span>
      </div>

      {/* Core Body Core Data */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-3 text-xs">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block">Patient</span>
          <p className="font-semibold text-slate-900 truncate">{item.name}</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">{item.age ?? 'N/A'}Y &bull; {item.gender || 'N/A'}</p>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block">Schedule Time</span>
          <p className="font-semibold text-slate-800">{item.appointment_date}</p>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
            {item.time || 'N/A'}
            {isInsideReminderWindow && <span className="h-2 w-2 rounded-full bg-orange-500 inline-block animate-pulse" />}
          </p>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block">Contact / Actions</span>
          <a href={`tel:${item.mobile}`} className="text-blue-600 font-bold block mt-0.5">{item.mobile}</a>
          <div className="flex items-center gap-2 mt-1">
            <button onClick={() => onWhatsApp(item.mobile, 'default', item)} className="text-[10px] font-bold text-emerald-600 flex items-center">
              <MessageCircle className="w-3 h-3 mr-0.5" /> Chat
            </button>
            <select defaultValue="" onChange={e => { onWhatsApp(item.mobile, e.target.value, item); e.target.value = ''; }} className="text-[10px] font-semibold px-1 py-0.5 rounded border border-slate-200 bg-white text-slate-500 cursor-pointer">
              <option value="">Alert Template</option>
              <option value="welcome">Welcome</option>
              <option value="report">Ready</option>
              <option value="reminder">Remind</option>
            </select>
          </div>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block">Medical Profiles</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <button type="button" onClick={() => onViewTests(item)} className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[10px] font-bold">Investigations</button>
            {item.prescription_url && (
              <a href={item.prescription_url} target="_blank" rel="noreferrer" className="px-2 py-0.5 bg-slate-50 text-slate-600 border border-slate-200 rounded text-[10px] font-bold">Rx Link</a>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Address and Remarks Context on Mobile */}
      <div className="bg-slate-50 rounded-xl p-2.5 space-y-2 border border-slate-100">
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase block">Logistics Destination</span>
          {isHomeCollection ? (
            <p className="text-[11px] text-slate-600 font-medium leading-relaxed truncate">{item.address_line || item.address}</p>
          ) : (
            <span className="text-[9px] font-bold text-slate-400 uppercase">Walk-in Baseline</span>
          )}
        </div>
        <InternalRemarksLogger item={item} onUpdateRemarks={onUpdateRemarks} />
      </div>

      {/* Bottom Processing Control Bar */}
      <div className="flex items-center justify-end gap-1.5 border-t border-slate-100 pt-2.5">
        <button onClick={() => onUpdateStatus(item.id, 'Completed')} className="flex-1 max-w-[120px] py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1"><Check className="w-3 h-3" /> Done</button>
        <button onClick={() => onUpdateStatus(item.id, 'Cancelled')} className="flex-1 max-w-[120px] py-1 bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1"><X className="w-3 h-3" /> Cancel</button>
        <button onClick={() => onDelete(item.id)} className="p-1 text-slate-400 hover:text-rose-500 transition"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

/* Internal Remarks Logger Component shared by both view layers */
function InternalRemarksLogger({ item, onUpdateRemarks }: any) {
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

  return (
    <div className="flex flex-col gap-1 w-full relative">
      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Internal Operational Remarks</span>
      <div className="relative w-full">
        <textarea
          value={localRemarks} 
          onChange={(e) => setLocalRemarks(e.target.value)} 
          onFocus={() => setIsFocused(true)} 
          onBlur={handleRemarksBlur} 
          placeholder="Add operational notes or follow up notes..." 
          rows={2} 
          disabled={isSaving} 
          className="w-full text-xs font-medium p-2 bg-white rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/5 outline-none resize-none transition-all custom-scrollbar" 
        />
        <div className="absolute right-2 bottom-2 flex items-center gap-1 pointer-events-none select-none">
          {isSaving && <RotateCw className="w-3 h-3 text-blue-500 animate-spin" />}
          {showSavedCheck && (
            <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200/60 font-bold text-[9px] uppercase tracking-wider animate-[fadeIn_0.15s_ease-out]">
              <Check className="w-2 h-2 stroke-[3]" /> Saved
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
