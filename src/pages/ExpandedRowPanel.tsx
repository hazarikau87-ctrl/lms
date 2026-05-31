// components/ExpandedRowPanel.tsx
import React from 'react';
import { FileText, Phone, MessageCircle, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ExpandedRowPanelProps {
  item: any;
  onWhatsApp: (phone: string, type: string, item: any) => void;
  onViewAddress: (item: any) => void;
  isHomeCollection: boolean;
}

export default function ExpandedRowPanel({
  item,
  onWhatsApp,
  onViewAddress,
  isHomeCollection
}: ExpandedRowPanelProps) {
  return (
    <td colSpan={6} className="px-8 py-4 bg-slate-50/60 border-t border-b border-slate-100">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-600">
        
        {/* Box 1: Prescription Data */}
        <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-2xs">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-2">Prescription Doc</span>
          {item.prescription_url ? (
            <a 
              href={item.prescription_url.startsWith('http') ? item.prescription_url : supabase.storage.from('prescriptions').getPublicUrl(item.prescription_url).data.publicUrl} 
              target="_blank" 
              rel="noreferrer" 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg font-semibold text-blue-700 transition"
            >
              <FileText className="w-3.5 h-3.5" /> View Prescription (Rx)
            </a>
          ) : (
            <span className="text-slate-400 font-medium italic block py-1">No file attached</span>
          )}
        </div>

        {/* Box 2: Contact Profiles */}
        <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-2xs">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1.5">Contact Profile</span>
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

        {/* Box 3: Fullfillment Matrix */}
        <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-2xs">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-2">Fulfillment Target</span>
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
  );
}
