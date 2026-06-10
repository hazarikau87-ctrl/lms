import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  User, Phone, Mail, Calendar, Clock, Beaker, MapPin,
  AlertCircle, CheckCircle, Upload, X,
  Loader2, ChevronRight, ChevronLeft, Stethoscope, Search,
  FileText, Home, Building2, Hash, StickyNote, MessageCircle,
  RotateCcw, ClipboardCheck, BadgeCheck, CreditCard
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import BillingModule from './BillingModule';

// ============== INTERFACES (STRICT DATABASE MATCH) ==============
export interface AppointmentData {
  id?: string;
  name: string;
  mobile: string;
  whatsapp: string;
  email: string;
  age: string;
  gender: 'Male' | 'Female' | 'Other' | '';
  appointment_date: string;
  time: string;
  test: string;
  booking_id?: string;
  status: 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';
  is_deleted: boolean;
  deleted_at: string | null;
  remarks: string;
  created_at?: string;
  lab_id: string;
  prescription_url: string;
  booking_type: 'walk-in' | 'home';
  address_line: string;
  pincode: string;
  landmark: string;
}

interface LabData {
  id: string;
  lab_name: string;
  theme_color?: string;
  available_tests?: any[];
}

interface ValidationErrors {
  [key: string]: string;
}

interface BookingRegistrationFormProps {
  onSuccess?: (data: AppointmentData) => void;
  onCancel?: () => void;
  currentLabId?: string;
  isOpen?: boolean;
}

const TIME_SLOTS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00',
];

const formatSlot = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
};

const fieldClass =
  'w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-sm text-gray-800 ' +
  'focus:outline-none focus:ring-2 focus:border-transparent transition-all ' +
  'disabled:bg-gray-50 disabled:text-gray-400 placeholder:text-gray-400';

const fieldClassError =
  'w-full px-3 py-2.5 border border-red-400 rounded-lg bg-white text-sm text-gray-800 ' +
  'focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent transition-all ' +
  'disabled:bg-gray-50';

const labelClass = 'block text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5';

const validateStep1 = (formData: any): ValidationErrors => {
  const e: ValidationErrors = {};
  if (!formData.name.trim()) e.name = 'Patient name is required';
  if (!formData.mobile.match(/^[0-9]{10}$/)) e.mobile = 'Valid 10-digit mobile number required';
  if (!formData.age || parseInt(formData.age) < 0 || parseInt(formData.age) > 120) e.age = 'Valid age (0–120) required';
  if (!formData.gender) e.gender = 'Please select a gender';
  return e;
};

const validateStep2 = (formData: any, selectedTests: string[]): ValidationErrors => {
  const e: ValidationErrors = {};
  if (selectedTests.length === 0) e.tests = 'Select at least one diagnostic test';
  if (!formData.appointment_date) e.appointment_date = 'Appointment date is required';
  if (!formData.time) e.time = 'Please select a time slot';
  return e;
};

const validateStep3 = (formData: any): ValidationErrors => {
  const e: ValidationErrors = {};
  if (formData.booking_type === 'home' && !formData.address_line.trim()) {
    e.address_line = 'Address line is required for home service validation execution checks';
  }
  return e;
};

export const BookingRegistrationForm: React.FC<BookingRegistrationFormProps> = ({
  onSuccess,
  onCancel,
  currentLabId = 'b07973eb-2591-4993-85f1-3d02773229bc',
  isOpen = true,
}) => {
  const [labInfo, setLabInfo] = useState<LabData | null>(null);
  const [dynamicTests, setDynamicTests] = useState<string[]>([]);
  const [testSearch, setTestSearch] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    whatsapp: '',
    email: '',
    age: '',
    gender: '' as 'Male' | 'Female' | 'Other' | '',
    appointment_date: '',
    time: '',
    status: 'Pending' as 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled',
    remarks: '',
    booking_type: 'walk-in' as 'walk-in' | 'home',
    address_line: '',
    pincode: '',
    landmark: '',
  });

  const [whatsappSameAsMobile, setWhatsappSameAsMobile] = useState(false);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  
  const [savedBookingId, setSavedBookingId] = useState('');
  const [savedAppointmentId, setSavedAppointmentId] = useState<number | null>(null);
  
  const [activeStep, setActiveStep] = useState(1);
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [prescriptionPreview, setPrescriptionPreview] = useState<string | null>(null);
  const [prescriptionFileName, setPrescriptionFileName] = useState('');
  
  const [showBilling, setShowBilling] = useState(false);
  
  // Store appointment data temporarily (not saved yet)
  const pendingAppointmentData = useRef<any>(null);

  const isProcessingPayload = useRef(false);

  const getTestStringValue = (item: any): string => {
    if (!item) return '';
    if (typeof item === 'string') return item;
    if (typeof item === 'object') {
      return item.name || item.test_name || item.title || JSON.stringify(item);
    }
    return String(item);
  };

  useEffect(() => {
    const fetchLabLogics = async () => {
      try {
        const { data, error } = await supabase
          .from('labs')
          .select('id, lab_name, theme_color, available_tests')
          .eq('id', currentLabId)
          .single();

        if (error) throw error;
        if (data) {
          setLabInfo(data);
          if (Array.isArray(data.available_tests)) {
            const parsedTests = data.available_tests
              .map((item) => getTestStringValue(item))
              .filter((name) => name.trim() !== '');
            setDynamicTests(parsedTests);
          }
        }
      } catch (err) {
        console.error('Error fetching configuration metrics maps:', err);
        setLabInfo({ id: currentLabId, lab_name: 'Diagnostic Lab Workspace' });
      }
    };

    if (isOpen) fetchLabLogics();
  }, [currentLabId, isOpen]);

  useEffect(() => {
    if (whatsappSameAsMobile) {
      setFormData((prev) => ({ ...prev, whatsapp: prev.mobile }));
    }
  }, [formData.mobile, whatsappSameAsMobile]);

  const handleBlur = (field: string) => {
    setTouchedFields((prev) => new Set(prev).add(field));
    const step1Errs = validateStep1(formData);
    setErrors((prev) => ({
      ...prev,
      [field]: step1Errs[field] || '',
    }));
  };

  const field = (key: string) => ({
    value: (formData as any)[key],
    disabled: isSubmitting || submitSuccess,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setFormData((prev) => ({ ...prev, [key]: e.target.value })),
    onBlur: () => handleBlur(key),
    className: errors[key] && touchedFields.has(key) ? fieldClassError : fieldClass,
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, prescription: 'File size must be under 5MB' }));
        return;
      }
      const isPdf = file.type === 'application/pdf';
      setPrescriptionFileName(file.name);
      setPrescriptionPreview(isPdf ? null : URL.createObjectURL(file));
      setPrescriptionFile(file);
      setErrors((prev) => ({ ...prev, prescription: '' }));
    }
  }, []);

  const toggleTest = (testName: string) => {
    setSelectedTests((prev) =>
      prev.includes(testName) ? prev.filter((t) => t !== testName) : [...prev, testName]
    );
    if (errors.tests) setErrors((prev) => ({ ...prev, tests: '' }));
  };

  const handleNext = () => {
    let stepErrors: ValidationErrors = {};
    if (activeStep === 1) stepErrors = validateStep1(formData);
    if (activeStep === 2) stepErrors = validateStep2(formData, selectedTests);
    if (activeStep === 3) stepErrors = validateStep3(formData);

    if (Object.keys(stepErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...stepErrors }));
      setTouchedFields((prev) => {
        const next = new Set(prev);
        Object.keys(stepErrors).forEach((k) => next.add(k));
        return next;
      });
      return;
    }
    setActiveStep((p) => p + 1);
  };

  const validateForm = (): boolean => {
    const allErrors = {
      ...validateStep1(formData),
      ...validateStep2(formData, selectedTests),
      ...validateStep3(formData),
    };
    setErrors(allErrors);
    return Object.keys(allErrors).length === 0;
  };

  // Prepare appointment but DON'T save it yet
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessingPayload.current || isSubmitting || submitSuccess) return;
    if (!validateForm()) return;

    isProcessingPayload.current = true;
    setIsSubmitting(true);
    let finalPrescriptionUrl = '';

    try {
      if (prescriptionFile) {
        const fileExt = prescriptionFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${currentLabId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('prescriptions')
          .upload(filePath, prescriptionFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('prescriptions')
          .getPublicUrl(filePath);

        finalPrescriptionUrl = urlData.publicUrl;
      }

      const generatedBookingId = `BK-${Date.now().toString().slice(-6)}`;

      // Store appointment data temporarily (not in DB yet)
      pendingAppointmentData.current = {
        name: formData.name,
        mobile: formData.mobile,
        whatsapp: formData.whatsapp || formData.mobile,
        email: formData.email || null,
        age: parseInt(formData.age),
        gender: formData.gender,
        appointment_date: formData.appointment_date,
        time: formData.time,
        test: selectedTests.join(', '),
        booking_id: generatedBookingId,
        status: formData.status,
        is_deleted: false,
        deleted_at: null,
        remarks: formData.remarks || null,
        lab_id: currentLabId,
        prescription_url: finalPrescriptionUrl || null,
        booking_type: formData.booking_type,
        address_line: formData.booking_type === 'home' ? formData.address_line : null,
        pincode: formData.booking_type === 'home' ? formData.pincode : null,
        landmark: formData.booking_type === 'home' ? formData.landmark : null,
      };

      setSavedBookingId(generatedBookingId);
      setSubmitSuccess(true);
      setIsSubmitting(false);
    } catch (err: any) {
      console.error('Preparation Error:', err);
      setErrors((prev) => ({
        ...prev,
        global: err.message || 'Failed to prepare appointment. Please try again.',
      }));
      isProcessingPayload.current = false;
      setIsSubmitting(false);
    }
  };

  // Save appointment to database (called after billing or skip)
  const saveAppointmentToDatabase = async () => {
    if (!pendingAppointmentData.current) return;

    try {
      const { data, error: dbError } = await supabase
        .from('appointments')
        .insert([pendingAppointmentData.current])
        .select()
        .single();

      if (dbError) throw dbError;

      setSavedAppointmentId(data.id as number);
      if (onSuccess) onSuccess(data);
      
      return data;
    } catch (err: any) {
      console.error('Database Save Error:', err);
      throw err;
    }
  };

  // Called after billing is completed or skipped
  const handleBillingComplete = async () => {
    try {
      await saveAppointmentToDatabase();
      handleReset();
      if (onCancel) onCancel();
    } catch (err) {
      console.error('Error saving after billing:', err);
    }
  };

  const handleReset = () => {
    setFormData({
      name: '', mobile: '', whatsapp: '', email: '', age: '',
      gender: '', appointment_date: '', time: '', status: 'Pending',
      remarks: '', booking_type: 'walk-in', address_line: '', pincode: '', landmark: '',
    });
    setSelectedTests([]);
    setErrors({});
    setTouchedFields(new Set());
    setIsSubmitting(false);
    setSubmitSuccess(false);
    setSavedBookingId('');
    setSavedAppointmentId(null);
    setPrescriptionFile(null);
    setPrescriptionPreview(null);
    setPrescriptionFileName('');
    setWhatsappSameAsMobile(false);
    setTestSearch('');
    setActiveStep(1);
    setShowBilling(false);
    pendingAppointmentData.current = null;
    isProcessingPayload.current = false;
  };

  const steps = [
    { number: 1, label: 'Patient Info', icon: User },
    { number: 2, label: 'Tests & Schedule', icon: Beaker },
    { number: 3, label: 'Logistics', icon: MapPin },
  ];

  const themeColor = labInfo?.theme_color || '#4f46e5';

  const filteredTests = dynamicTests.filter((t) =>
    t.toLowerCase().includes(testSearch.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="relative max-w-2xl w-full mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '92vh' }}
      >
        {/* Header section panel */}
        <div style={{ backgroundColor: themeColor }} className="relative px-6 py-5 text-white flex-shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/15">
                <Stethoscope className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight leading-tight">
                  {labInfo?.lab_name || 'Loading…'}
                </h2>
                <p className="text-[11px] text-white/60 mt-0.5 font-mono">Lab ID Reference: {currentLabId}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onCancel && submitSuccess === false && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/25 transition-colors disabled:opacity-30"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {!submitSuccess && (
            <div className="flex items-center gap-0 mt-5">
              {steps.map((step, idx) => {
                const isActive = activeStep === step.number;
                const isDone = activeStep > step.number;
                return (
                  <React.Fragment key={step.number}>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        if (step.number < activeStep) setActiveStep(step.number);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                        ${isActive ? 'bg-white shadow text-gray-900'
                          : isDone ? 'bg-white/25 text-white'
                          : 'bg-white/10 text-white/60'}`}
                    >
                      {isDone ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <step.icon className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{step.label}</span>
                      <span className="sm:hidden">{step.number}</span>
                    </button>
                    {idx < steps.length - 1 && (
                      <div className={`h-px flex-1 mx-1 transition-all ${isDone ? 'bg-white/50' : 'bg-white/15'}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        {errors.global && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2 text-sm">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <span>{errors.global}</span>
          </div>
        )}

        {/* ── CENTRAL SWITCH PANEL STATE VIEW FOR WORKSPACE SUCCESS DRIVER ── */}
        {submitSuccess ? (
          <div className="flex flex-col flex-1 overflow-y-auto bg-gray-50/50">
            {!showBilling && (
              <div className="flex flex-col items-center justify-center px-8 py-12 text-center max-w-md mx-auto my-auto gap-6 animate-in fade-in zoom-in-95 duration-150">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center shadow-sm">
                  <BadgeCheck className="w-9 h-9 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 tracking-tight">Appointment Details Validated</h3>
                  <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                    Please complete billing to finalize the appointment registration.
                  </p>
                </div>

                <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-5 py-3.5 shadow-sm w-full justify-center">
                  <Hash className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Booking ID</span>
                  <span className="font-mono font-bold text-gray-900 text-base border-l border-gray-150 pl-3 ml-1">
                    {savedBookingId}
                  </span>
                </div>

                <div className="w-full bg-white border border-gray-100 rounded-2xl p-5 shadow-sm text-left mt-2">
                  <h4 className="text-sm font-bold text-gray-900 mb-1">Financial Ledger</h4>
                  <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                    Would you like to collect patient payments or log financial balances right now?
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBilling(true)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white rounded-xl shadow-sm transition-all duration-150 hover:opacity-95 active:scale-95"
                      style={{ backgroundColor: themeColor }}
                    >
                      <CreditCard className="w-4 h-4" />
                      Collect Payment Now
                    </button>
                    <button
                      type="button"
                      onClick={handleBillingComplete}
                      className="flex-1 px-4 py-2.5 text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      Skip & Finalize
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showBilling && savedAppointmentId === null && (
              <div className="px-6 py-6 flex flex-col flex-1 animate-in slide-in-from-bottom-4 duration-200">
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-xl text-gray-600">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Collections Counter</p>
                      <p className="text-[11px] font-mono text-gray-400 mt-0.5">Booking Identity: {savedBookingId}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBilling(false)}
                    className="text-xs font-semibold text-gray-400 hover:text-gray-600 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Back
                  </button>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex-1 overflow-y-auto">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                    <p className="text-xs text-amber-800 font-semibold">
                      ⚠️ Appointment will be saved AFTER payment is completed
                    </p>
                  </div>
                  
                  <BillingModule
                    appointmentId={999999}
                    labId={currentLabId}
                    selectedTests={selectedTests}
                    availableTestsMeta={labInfo?.available_tests || []}
                    themeColor={themeColor}
                    isInline={true}
                    onPaymentSuccess={handleBillingComplete}
                  />
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-2.5 justify-between items-center bg-transparent">
                  <p className="text-[11px] text-gray-400 italic">
                    * Appointment saves to database after payment is recorded.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="overflow-y-auto flex-1 px-6 py-5">
              {/* STEP 1 CONTAINER */}
              {activeStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Patient Name *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <input type="text" placeholder="e.g. Rahul Sharma" {...field('name')} className={`${errors.name && touchedFields.has('name') ? fieldClassError : fieldClass} pl-9`} />
                    </div>
                    {errors.name && touchedFields.has('name') && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Mobile Number *</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                        <input type="tel" placeholder="10-digit number" {...field('mobile')} className={`${errors.mobile && touchedFields.has('mobile') ? fieldClassError : fieldClass} pl-9`} />
                      </div>
                      {errors.mobile && touchedFields.has('mobile') && <p className="text-xs text-red-500 mt-1">{errors.mobile}</p>}
                    </div>

                    <div>
                      <label className={labelClass}>WhatsApp Number</label>
                      <div className="relative">
                        <MessageCircle className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                        <input type="tel" placeholder={whatsappSameAsMobile ? "Auto-filled" : "Optional"} value={whatsappSameAsMobile ? formData.mobile : formData.whatsapp} disabled={isSubmitting || submitSuccess} onChange={(e) => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))} className={`${fieldClass} pl-9`} />
                      </div>
                      <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs text-gray-500 selection:bg-transparent">
                        <input type="checkbox" checked={whatsappSameAsMobile} onChange={(e) => setWhatsappSameAsMobile(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                        <span>Same as mobile number</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <input type="email" placeholder="patient@example.com" {...field('email')} className={`${fieldClass} pl-9`} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Age *</label>
                      <input type="number" placeholder="Years" {...field('age')} />
                      {errors.age && touchedFields.has('age') && <p className="text-xs text-red-500 mt-1">{errors.age}</p>}
                    </div>

                    <div>
                      <label className={labelClass}>Gender *</label>
                      <select {...field('gender')} style={{ appearance: 'auto' }}>
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                      {errors.gender && touchedFields.has('gender') && <p className="text-xs text-red-500 mt-1">{errors.gender}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2 CONTAINER */}
              {activeStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className={labelClass}>Select Tests *</label>
                      {selectedTests.length > 0 && (
                        <span style={{ backgroundColor: themeColor }} className="text-[10px] text-white font-bold px-2 py-0.5 rounded-full">
                          {selectedTests.length} Selected
                        </span>
                      )}
                    </div>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <input type="text" placeholder="Search operational tests catalogue matrix…" value={testSearch} onChange={(e) => setTestSearch(e.target.value)} className={`${fieldClass} pl-9`} />
                    </div>

                    <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 bg-gray-50 overflow-y-auto">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-200/60">
                        {filteredTests.map((testName, idx) => {
                          const isChecked = selectedTests.includes(testName);
                          return (
                            <label key={idx} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50/80 transition-colors cursor-pointer text-sm font-medium text-gray-700">
                              <input type="checkbox" checked={isChecked} onChange={() => toggleTest(testName)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                              <span>{testName}</span>
                            </label>
                          );
                        })}
                        {filteredTests.length === 0 && (
                          <div className="p-8 text-center text-sm text-gray-400 bg-white col-span-2">No matching tests found.</div>
                        )}
                      </div>
                    </div>
                    {errors.tests && <p className="text-xs text-red-500 mt-1">{errors.tests}</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Appointment Date *</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                        <input type="date" min={new Date().toISOString().split('T')[0]} value={formData.appointment_date} onChange={(e) => setFormData(prev => ({ ...prev, appointment_date: e.target.value }))} className={`${fieldClass} pl-9`} />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>Booking Modality Type</label>
                      <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-gray-100 p-1 gap-1 h-[44px]">
                        {(['walk-in', 'home'] as const).map((mode) => (
                          <button key={mode} type="button" onClick={() => setFormData(prev => ({ ...prev, booking_type: mode }))} className={`flex-1 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${formData.booking_type === mode ? 'bg-white text-gray-900 shadow' : 'text-gray-500'}`}>
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Time Slot *</label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-36 overflow-y-auto border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                      {TIME_SLOTS.map((slot) => {
                        const isSelected = formData.time === slot;
                        return (
                          <button key={slot} type="button" onClick={() => setFormData(prev => ({ ...prev, time: slot }))} className={`py-2 text-xs font-semibold rounded-lg border transition-all ${isSelected ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-gray-200 text-gray-600'}`}>
                            {formatSlot(slot)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3 CONTAINER */}
              {activeStep === 3 && (
                <div className="space-y-4">
                  {formData.booking_type === 'home' && (
                    <div className="space-y-4 p-4 border border-dashed border-gray-200 rounded-xl bg-gray-50/40">
                      <div>
                        <label className={labelClass}>Collection Address Line *</label>
                        <textarea rows={2} placeholder="Complete physical logistics address details…" value={formData.address_line} onChange={(e) => setFormData(prev => ({ ...prev, address_line: e.target.value }))} className={fieldClass} />
                        {errors.address_line && <p className="text-xs text-red-500 mt-1">{errors.address_line}</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>Pincode</label>
                          <input type="text" placeholder="6-digit PIN" value={formData.pincode} onChange={(e) => setFormData(prev => ({ ...prev, pincode: e.target.value }))} className={fieldClass} />
                        </div>
                        <div>
                          <label className={labelClass}>Landmark</label>
                          <input type="text" placeholder="Nearby reference item" value={formData.landmark} onChange={(e) => setFormData(prev => ({ ...prev, landmark: e.target.value }))} className={fieldClass} />
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className={labelClass}>Prescription Attachment File</label>
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center bg-gray-50 hover:bg-gray-100/50 transition-colors relative">
                      <input type="file" accept="image/*,application/pdf" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isSubmitting} />
                      <div className="space-y-1.5">
                        <Upload className="w-6 h-6 text-gray-400 mx-auto" />
                        <p className="text-xs text-gray-500 font-medium">Click to select files or drag-drop</p>
                        <p className="text-[10px] text-gray-400">PDF, PNG, JPG format (Max size: 5MB)</p>
                      </div>
                    </div>
                    {prescriptionFileName && (
                      <div className="mt-2.5 flex items-center justify-between p-2 text-xs bg-gray-100 text-gray-700 rounded-lg">
                        <span className="truncate font-medium max-w-[80%]">{prescriptionFileName}</span>
                        <button type="button" onClick={() => { setPrescriptionFile(null); setPrescriptionPreview(null); setPrescriptionFileName(''); }} className="text-gray-400 hover:text-red-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>Internal Office Remarks</label>
                    <textarea rows={2} placeholder="Any specific execution observations or patient parameters requests…" value={formData.remarks} onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))} className={fieldClass} />
                  </div>
                </div>
              )}
            </div>

            {/* Footer triggers */}
            <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100 bg-white flex-shrink-0">
              <button type="button" disabled={activeStep === 1 || isSubmitting} onClick={() => setActiveStep((p) => p - 1)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />Back
              </button>

              {activeStep < 3 ? (
                <button type="button" onClick={handleNext} className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90" style={{ backgroundColor: themeColor }}>
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white rounded-lg shadow transition-opacity hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: themeColor }}>
                  {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Validating…</> : <><CheckCircle className="w-4 h-4" />Proceed to Billing</>}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default BookingRegistrationForm;
