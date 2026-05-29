import React, { useState, useEffect } from 'react';
import { X, Edit3, User, Sunrise, Sun, Sunset, RotateCw, Save } from 'lucide-react';
import { supabase, Appointment } from '../lib/supabase';

// Curated business-hours time slot matrices grouped by period intent
const TIME_SLOTS_PRESET = {
  morning: ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00'],
  afternoon: ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
  evening: ['18:00', '19:00', '20:00', '21:00']
};

interface RescheduleDrawerProps {
  appointment: (Appointment & { whatsapp?: string }) | null;
  labId: string | number | undefined;
  onClose: () => void;
  onSuccess: (updatedFields: { appointment_date: string; time: string; whatsapp: string }) => void;
}

export default function RescheduleDrawer({ appointment, labId, onClose, onSuccess }: RescheduleDrawerProps) {
  const [editFormDate, setEditFormDate] = useState('');
  const [editFormTime, setEditFormTime] = useState('');
  const [editFormWhatsApp, setEditFormWhatsApp] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Initialize form state when an appointment is loaded into the drawer
  useEffect(() => {
    if (appointment) {
      setEditFormDate(appointment.appointment_date || '');
      setEditFormTime(appointment.time || '08:00');
      setEditFormWhatsApp(appointment.whatsapp || appointment.mobile || '');
    }
  }, [appointment]);

  if (!appointment) return null;

  const handleCommitBookingEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labId) return;

    setIsSavingEdit(true);
    try {
      const updates = {
        appointment_date: editFormDate,
        time: editFormTime,
        whatsapp: editFormWhatsApp
      };

      const { error } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', appointment.id)
        .eq('lab_id', labId);

      if (error) throw error;

      // Pass updated coordinates back to update local parent states dynamically
      onSuccess(updates);
      onClose();
    } catch (err) {
      console.error("Critical rescheduling edit failure:", err);
      alert("Failed to commit scheduling edits. Please try again.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-50 flex justify-end animate-[fadeIn_0.15s_ease-out]"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col border-l border-slate-200 animate-[slideLeft_0.2s_ease-out]"
      >
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-50 border border-blue-200/60 text-blue-600 rounded-lg flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Manage Appointment</h3>
              <p className="text-[10px] font-mono text-slate-400 mt-0.5">ID: {appointment.booking_id}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-600 hover:shadow-sm transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Sheet Content */}
        <form onSubmit={handleCommitBookingEdits} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* Patient Core Summary Card */}
          <div className="p-4 rounded-xl border border-slate-200/70 bg-slate-50/50 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 flex-shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Patient Overview</p>
              <p className="text-sm font-bold text-slate-900">{appointment.name}</p>
              <p className="text-xs font-semibold text-slate-500">
                {appointment.age ?? 'N/A'} Y &bull; {appointment.gender || 'N/A'}
              </p>
              <div className="pt-2">
                <span className="inline-block bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px] font-medium text-slate-600">
                  {appointment.test}
                </span>
              </div>
            </div>
          </div>

          {/* Action Fields */}
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">Appointment Execution Date</label>
              <input 
                type="date"
                required
                value={editFormDate}
                onChange={(e) => setEditFormDate(e.target.value)}
                className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition"
              />
            </div>

            {/* PREMIUM GRID-BASED TIME TIMELINE PRESETS PICKER */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 block">Reschedule Booking Time Coordinates</label>
              
              {/* Morning Block */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Sunrise className="w-3 h-3 text-amber-500" /> Morning slots
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {TIME_SLOTS_PRESET.morning.map(slot => (
                    <button key={slot} type="button" onClick={() => setEditFormTime(slot)} className={`py-2 text-xs font-mono font-bold rounded-xl transition border ${editFormTime === slot ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'}`}>{slot}</button>
                  ))}
                </div>
              </div>

              {/* Afternoon Block */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Sun className="w-3 h-3 text-orange-500" /> Afternoon slots
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {TIME_SLOTS_PRESET.afternoon.map(slot => (
                    <button key={slot} type="button" onClick={() => setEditFormTime(slot)} className={`py-2 text-xs font-mono font-bold rounded-xl transition border ${editFormTime === slot ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'}`}>{slot}</button>
                  ))}
                </div>
              </div>

              {/* Evening Block */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Sunset className="w-3 h-3 text-indigo-500" /> Evening slots
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {TIME_SLOTS_PRESET.evening.map(slot => (
                    <button key={slot} type="button" onClick={() => setEditFormTime(slot)} className={`py-2 text-xs font-mono font-bold rounded-xl transition border ${editFormTime === slot ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'}`}>{slot}</button>
                  ))}
                </div>
              </div>
            </div>

            <hr className="border-slate-100 my-1" />

            {/* TARGETED WHATSAPP INTERACTION ROUTE */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-500">Dedicated WhatsApp Contact Target</label>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded font-medium">Alert Destination Override</span>
              </div>
              <input 
                type="tel"
                required
                value={editFormWhatsApp}
                onChange={(e) => setEditFormWhatsApp(e.target.value)}
                placeholder="Enter patient country code + whatsapp number..."
                className="w-full text-xs font-mono font-bold tracking-wide px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition"
              />
            </div>
          </div>
        </form>

        {/* Fixed Drawer Action Sticky Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-3 justify-end">
          <button 
            type="button"
            disabled={isSavingEdit}
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 bg-white text-slate-600 font-semibold rounded-xl text-xs hover:bg-slate-50 transition disabled:opacity-50"
          >
            Discard
          </button>
          <button 
            onClick={handleCommitBookingEdits}
            disabled={isSavingEdit}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow-sm shadow-blue-600/10 transition disabled:opacity-50"
          >
            {isSavingEdit ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
