import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, User, Phone, Mail, Calendar, Clock, Beaker, MapPin, FileText, RotateCw, CheckCircle2 } from 'lucide-react';

export interface AppointmentData {
  name: string;
  mobile: string;
  whatsapp: string;
  email: string;
  age: number | '';
  gender: string;
  appointment_date: string;
  time: string;
  test: string;
  status: 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';
  is_deleted: boolean;
  remarks: string;
  lab_id: string;
  prescription_url: string;
  booking_type: 'Walk-in' | 'Home Collection' | 'Online';
  address_line: string;
  pincode: string;
  landmark: string;
}

interface BookingRegistrationFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const BookingRegistrationForm: React.FC<BookingRegistrationFormProps> = ({ 
  onSuccess, 
  onCancel 
}) => {
  const { user } = useAuth();
  const [activeLabId, setActiveLabId] = useState<string | null>(null);
  const [fetchingLab, setFetchingLab] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State matching your table column mappings
  const [formData, setFormData] = useState<AppointmentData>({
    name: '',
    mobile: '',
    whatsapp: '',
    email: '',
    age: '',
    gender: '',
    appointment_date: new Date().toISOString().split('T')[0], // Default to today
    time: '',
    test: '',
    status: 'Pending',
    is_deleted: false,
    remarks: '',
    lab_id: '',
    prescription_url: '',
    booking_type: 'Walk-in',
    address_line: '',
    pincode: '',
    landmark: ''
  });

  // Multi-tenant configuration matcher matching Dashboard.tsx logic
  useEffect(() => {
    async function getTenantLabId() {
      if (!user?.id) return;
      try {
        setFetchingLab(true);
        const { data: adminLink, error: adminError } = await supabase
          .from('lab_admins')
          .select('lab_id')
          .eq('user_id', user.id)
          .single();

        if (adminError || !adminLink) {
          setErrorMessage("Multi-tenant Isolation Violation: No managed lab bound to this account.");
          return;
        }
        
        setActiveLabId(adminLink.lab_id);
        setFormData(prev => ({ ...prev, lab_id: adminLink.lab_id }));
      } catch (err) {
        console.error("Tenant resolution crash:", err);
        setErrorMessage("Failed to securely verify structural tenant profiles.");
      } finally {
        setFetchingLab(false);
      }
    }
    getTenantLabId();
  }, [user?.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'age' ? (value === '' ? '' : Number(value)) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLabId) return setErrorMessage("Cannot submit without verified tenant boundaries.");
    
    setIsSubmitting(true);
    setErrorMessage(null);

    // Auto-calculating dynamic metadata parameters before database engine execution
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const generatedBookingId = `LO-${Date.now().toString().slice(-5)}${randomSuffix}`;

    const submissionPayload = {
      ...formData,
      booking_id: generatedBookingId,
      created_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from('appointments')
        .insert([submissionPayload]);

      if (error) throw error;

      setSuccessMessage(`Appointment successfully recorded! ID: ${generatedBookingId}`);
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 1500);

    } catch (err: any) {
      console.error("Database structural insertion fault:", err);
      setErrorMessage(err.message || "Engine insertion aborted processing rules.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isHomeCollection = formData.booking_type === 'Home Collection';

  if (fetchingLab) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center gap-3">
        <RotateCw className="w-6 h-6 animate-spin text-blue-600" />
        <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Resolving Multi-Tenant Permissions...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-md overflow-hidden max-w-4xl mx-auto animate-[fadeIn_0.2s_ease-out]">
      {/* Top Banner Header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-slate-900">Direct Patient Intake Registration</h2>
          <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mt-0.5">Fulfillment Target Sub-Module</p>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs font-medium rounded-xl">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 animate-pulse" /> {successMessage}
          </div>
        )}

        {/* 1. Patient Profiles */}
        <div>
          <div className="flex items-center gap-1.5 text-blue-600 mb-3">
            <User className="w-3.5 h-3.5" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider">1. Demographic Information</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name *</label>
              <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition" placeholder="Patient Full Name" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Age *</label>
              <input required type="number" name="age" value={formData.age} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition" placeholder="Years" min="0" max="130" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Gender *</label>
              <select required name="gender" value={formData.gender} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition cursor-pointer">
                <option value="">Select Protocol</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mobile Core Number *</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input required type="tel" name="mobile" value={formData.mobile} onChange={handleChange} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition" placeholder="Primary Contact Phone" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">WhatsApp Forwarding</label>
              <input type="tel" name="whatsapp" value={formData.whatsapp} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition" placeholder="Leave empty to clone mobile" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email Matrix Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition" placeholder="patient@domain.com" />
              </div>
            </div>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* 2. Diagnostics Execution Metadata */}
        <div>
          <div className="flex items-center gap-1.5 text-blue-600 mb-3">
            <Beaker className="w-3.5 h-3.5" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider">2. Diagnostics & Scheduling Matrix</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Clinical Investigation Protocol Codes *</label>
              <input required type="text" name="test" value={formData.test} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition" placeholder="e.g. Complete Blood Count, Serum Creatinine (Comma separated)" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fulfillment Vector</label>
              <select name="booking_type" value={formData.booking_type} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition cursor-pointer">
                <option value="Walk-in">Walk-in</option>
                <option value="Home Collection">Home Collection</option>
                <option value="Online">Online</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Date *</label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input required type="date" name="appointment_date" value={formData.appointment_date} onChange={handleChange} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition cursor-pointer" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Temporal Window (Time) *</label>
              <div className="relative">
                <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input required type="time" name="time" value={formData.time} onChange={handleChange} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition cursor-pointer" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Initialization Status State</label>
              <select name="status" value={formData.status} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition cursor-pointer">
                <option value="Pending">Pending Validation</option>
                <option value="Confirmed">Confirmed System-wide</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Prescription Asset Public Pointer Link (Rx URL)</label>
              <div className="relative">
                <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input type="url" name="prescription_url" value={formData.prescription_url} onChange={handleChange} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition" placeholder="https://supabase-storage-bucket/prescriptions/uuid.pdf" />
              </div>
            </div>
          </div>
        </div>

        {/* 3. Logistics and Geo-Routing Schema Panel */}
        <div className={`transition-all duration-300 ${isHomeCollection ? 'opacity-100 max-h-96' : 'opacity-40 pointer-events-none filter saturate-50'}`}>
          <hr className="border-slate-100 mb-6" />
          <div className="flex items-center gap-1.5 text-blue-600 mb-3">
            <MapPin className="w-3.5 h-3.5" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider">3. Geo-Routing & Logistics Layout {!isHomeCollection && "(Walk-In Skipped)"}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fulfillment Target Destination Address</label>
              <input :required={isHomeCollection} type="text" name="address_line" value={formData.address_line} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition" placeholder="Flat/House, Sector/Street Allocation Mapping" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Postal Routing Pin Code</label>
              <input :required={isHomeCollection} type="text" name="pincode" value={formData.pincode} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition" placeholder="6-Digit ZIP" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Identified Point of Interest / Landmark</label>
              <input type="text" name="landmark" value={formData.landmark} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition" placeholder="Alternative geographical reference markers..." />
            </div>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* 4. Telemetry Field Entry Logs */}
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Internal Operations Remarks & Progress Logs</label>
          <textarea rows={2} name="remarks" value={formData.remarks} onChange={handleChange} className="w-full p-3 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition resize-none" placeholder="Append historical comments, fasting directives, or collector assignment flags..." />
        </div>

        {/* Panel Action Control Triggers */}
        <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={isSubmitting} className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50">
              Cancel
            </button>
          )}
          <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-blue-600/10 transition disabled:opacity-50">
            {isSubmitting ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                Processing Transaction...
              </>
            ) : (
              "Commit Registration Pipeline"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
