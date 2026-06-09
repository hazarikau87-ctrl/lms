import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  User, Phone, Mail, Calendar, Clock, Beaker, MapPin,
  AlertCircle, CheckCircle, Upload, X,
  Loader2, ChevronRight, ChevronLeft, Stethoscope, Search,
  FileText, Home, Building2, Hash, StickyNote, MessageCircle,
  RotateCcw, ClipboardCheck, BadgeCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';

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

// ============== TIME SLOTS ==============
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

// ============== FIELD CLASSES ==============
const fieldClass =
  'w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-sm text-gray-800 ' +
  'focus:outline-none focus:ring-2 focus:border-transparent transition-all ' +
  'disabled:bg-gray-50 disabled:text-gray-400 placeholder:text-gray-400';

const fieldClassError =
  'w-full px-3 py-2.5 border border-red-400 rounded-lg bg-white text-sm text-gray-800 ' +
  'focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-transparent transition-all ' +
  'disabled:bg-gray-50';

const labelClass = 'block text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5';

// ============== STEP VALIDATORS ==============
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
    e.address = 'Address is required for home collection';
  }
  return e;
};

export const BookingRegistrationForm: React.FC<BookingRegistrationFormProps> = ({
  onSuccess,
  onCancel,
  currentLabId = 'LAB-001',
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
  const [activeStep, setActiveStep] = useState(1);
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [prescriptionPreview, setPrescriptionPreview] = useState<string | null>(null);
  const [prescriptionFileName, setPrescriptionFileName] = useState('');

  const isProcessingPayload = useRef(false);

  // ── Derived: total steps (walk-in skips step 3 logistics but still shows remarks)
  const totalSteps = formData.booking_type === 'walk-in' ? 3 : 3;

  // ── Safe JSONB test parser (unchanged from original)
  const getTestStringValue = (item: any): string => {
    if (!item) return '';
    if (typeof item === 'string') return item;
    if (typeof item === 'object') {
      return item.name || item.test_name || item.title || JSON.stringify(item);
    }
    return String(item);
  };

  // ── Fetch lab config (ORIGINAL SUPABASE LOGIC — UNTOUCHED)
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
          } else {
            setDynamicTests([]);
          }
        }
      } catch (err) {
        console.error('Error fetching available_tests from labs table:', err);
        setLabInfo({ id: currentLabId, lab_name: 'Diagnostic Lab Workspace' });
        setDynamicTests([]);
      }
    };

    if (isOpen) fetchLabLogics();
  }, [currentLabId, isOpen]);

  // ── Sync WhatsApp when "same as mobile" is checked
  useEffect(() => {
    if (whatsappSameAsMobile) {
      setFormData((prev) => ({ ...prev, whatsapp: prev.mobile }));
    }
  }, [formData.mobile, whatsappSameAsMobile]);

  // ── Blur-based inline validation
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

  // ── File upload handler (PDF-aware, ORIGINAL logic preserved)
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

  // ── Test toggle
  const toggleTest = (testName: string) => {
    setSelectedTests((prev) =>
      prev.includes(testName) ? prev.filter((t) => t !== testName) : [...prev, testName]
    );
    if (errors.tests) setErrors((prev) => ({ ...prev, tests: '' }));
  };

  // ── Per-step validation on Next click
  const handleNext = () => {
    let stepErrors: ValidationErrors = {};
    if (activeStep === 1) stepErrors = validateStep1(formData);
    if (activeStep === 2) stepErrors = validateStep2(formData, selectedTests);
    if (activeStep === 3) stepErrors = validateStep3(formData);

    if (Object.keys(stepErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...stepErrors }));
      // Mark all fields in the step as touched
      setTouchedFields((prev) => {
        const next = new Set(prev);
        Object.keys(stepErrors).forEach((k) => next.add(k));
        return next;
      });
      return;
    }
    setActiveStep((p) => p + 1);
  };

  // ── Full form validation for final submit
  const validateForm = (): boolean => {
    const allErrors = {
      ...validateStep1(formData),
      ...validateStep2(formData, selectedTests),
      ...validateStep3(formData),
    };
    setErrors(allErrors);
    return Object.keys(allErrors).length === 0;
  };

  // ── Submit (ORIGINAL SUPABASE LOGIC — UNTOUCHED)
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

      const targetPayload = {
        name: formData.name,
        mobile: formData.mobile,
        whatsapp: formData.whatsapp || formData.mobile,
        email: formData.email,
        age: parseInt(formData.age),
        gender: formData.gender,
        appointment_date: formData.appointment_date,
        time: formData.time,
        test: selectedTests.join(', '),
        booking_id: generatedBookingId,
        status: formData.status,
        is_deleted: false,
        deleted_at: null,
        remarks: formData.remarks,
        lab_id: currentLabId,
        prescription_url: finalPrescriptionUrl,
        booking_type: formData.booking_type,
        address_line: formData.booking_type === 'home' ? formData.address_line : '',
        pincode: formData.booking_type === 'home' ? formData.pincode : '',
        landmark: formData.booking_type === 'home' ? formData.landmark : '',
      };

      const { data, error: dbError } = await supabase
        .from('appointments')
        .insert([targetPayload])
        .select()
        .single();

      if (dbError) throw dbError;

      setSavedBookingId(generatedBookingId);
      setSubmitSuccess(true);
      if (onSuccess) onSuccess(data);
    } catch (err: any) {
      console.error('Database Save Error:', err);
      setErrors((prev) => ({
        ...prev,
        global: err.message || 'Failed to save appointment. Please try again.',
      }));
      isProcessingPayload.current = false;
      setIsSubmitting(false);
    }
  };

  // ── Reset for next patient
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
    setPrescriptionFile(null);
    setPrescriptionPreview(null);
    setPrescriptionFileName('');
    setWhatsappSameAsMobile(false);
    setTestSearch('');
    setActiveStep(1);
    isProcessingPayload.current = false;
  };

  const steps = [
    { number: 1, label: 'Patient Info', icon: User },
    { number: 2, label: 'Tests & Schedule', icon: Beaker },
    { number: 3, label: 'Logistics', icon: MapPin },
  ];

  const themeColor = labInfo?.theme_color || '#4f46e5';

  const stepHasErrors = (step: number): boolean => {
    if (step === 1) return Object.keys(validateStep1(formData)).length > 0;
    if (step === 2) return Object.keys(validateStep2(formData, selectedTests)).length > 0;
    if (step === 3) return Object.keys(validateStep3(formData)).length > 0;
    return false;
  };

  const filteredTests = dynamicTests.filter((t) =>
    t.toLowerCase().includes(testSearch.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative max-w-2xl w-full mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '92vh' }}>

        {/* ── HEADER ── */}
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
                <p className="text-[11px] text-white/60 mt-0.5 font-mono">ID: {currentLabId}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-white/50 font-medium">New Appointment</span>
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/25 transition-colors disabled:opacity-30"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Step Indicator */}
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
                      // only allow navigating back freely; forward requires validation
                      if (step.number < activeStep) setActiveStep(step.number);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                      ${isActive ? 'bg-white shadow text-gray-900'
                        : isDone ? 'bg-white/25 text-white'
                        : 'bg-white/10 text-white/60'}
                      disabled:cursor-default`}
                  >
                    {isDone
                      ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      : <step.icon className="w-3.5 h-3.5" />
                    }
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
        </div>

        {/* ── GLOBAL ERROR ── */}
        {errors.global && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2 text-sm">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <span>{errors.global}</span>
          </div>
        )}

        {/* ── SUCCESS PANEL ── */}
        {submitSuccess ? (
          <div className="flex flex-col items-center justify-center flex-1 px-6 py-10 text-center gap-5">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <BadgeCheck className="w-9 h-9 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">Appointment Registered</h3>
              <p className="text-sm text-gray-500 mt-1">Patient has been successfully added to the system.</p>
            </div>
            <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-xl px-5 py-3">
              <Hash className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-500 font-medium">Booking ID</span>
              <span className="font-mono font-bold text-gray-900 text-base ml-1">{savedBookingId}</span>
            </div>
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl shadow transition-opacity hover:opacity-90"
                style={{ backgroundColor: themeColor }}
              >
                <RotateCcw className="w-4 h-4" />
                Register Next Patient
              </button>
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        ) : (
          /* ── FORM ── */
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="overflow-y-auto flex-1 px-6 py-5">

              {/* ═══ STEP 1: Patient Info ═══ */}
              {activeStep === 1 && (
                <div className="space-y-4">

                  {/* Name */}
                  <div>
                    <label className={labelClass}>
                      <User className="inline w-3 h-3 mr-1 -mt-0.5" />Full Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      {...field('name')}
                      style={{ ['--tw-ring-color' as any]: themeColor }}
                    />
                    {errors.name && touchedFields.has('name') && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />{errors.name}
                      </p>
                    )}
                  </div>

                  {/* Mobile + WhatsApp */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>
                        <Phone className="inline w-3 h-3 mr-1 -mt-0.5" />Mobile <span className="text-red-400">*</span>
                      </label>
                      <input type="tel" placeholder="10-digit number" {...field('mobile')} />
                      {errors.mobile && touchedFields.has('mobile') && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />{errors.mobile}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>
                        <MessageCircle className="inline w-3 h-3 mr-1 -mt-0.5" />WhatsApp
                      </label>
                      <input
                        type="tel"
                        placeholder={whatsappSameAsMobile ? 'Auto-filled' : 'Optional'}
                        value={whatsappSameAsMobile ? formData.mobile : formData.whatsapp}
                        disabled={isSubmitting || whatsappSameAsMobile}
                        onChange={(e) => setFormData((prev) => ({ ...prev, whatsapp: e.target.value }))}
                        className={fieldClass}
                      />
                      <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer w-fit">
                        <input
                          type="checkbox"
                          checked={whatsappSameAsMobile}
                          onChange={(e) => setWhatsappSameAsMobile(e.target.checked)}
                          className="rounded border-gray-300 w-3.5 h-3.5"
                        />
                        <span className="text-[11px] text-gray-500">Same as mobile</span>
                      </label>
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className={labelClass}>
                      <Mail className="inline w-3 h-3 mr-1 -mt-0.5" />Email Address
                    </label>
                    <input type="email" placeholder="patient@example.com" {...field('email')} />
                  </div>

                  {/* Age + Gender */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Age (years) <span className="text-red-400">*</span></label>
                      <input type="number" min={0} max={120} placeholder="e.g. 34" {...field('age')} />
                      {errors.age && touchedFields.has('age') && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />{errors.age}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>Gender <span className="text-red-400">*</span></label>
                      <select {...field('gender')} style={{ appearance: 'auto' }}>
                        <option value="">— Select —</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                      {errors.gender && touchedFields.has('gender') && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />{errors.gender}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ STEP 2: Tests & Schedule ═══ */}
              {activeStep === 2 && (
                <div className="space-y-5">

                  {/* Tests */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className={labelClass}>
                        <Beaker className="inline w-3 h-3 mr-1 -mt-0.5" />
                        Available Diagnostics <span className="text-red-400">*</span>
                      </label>
                      {selectedTests.length > 0 && (
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: themeColor }}
                        >
                          {selectedTests.length} selected
                        </span>
                      )}
                    </div>

                    {/* Search */}
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search tests…"
                        value={testSearch}
                        onChange={(e) => setTestSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 bg-white"
                        style={{ ['--tw-ring-color' as any]: themeColor + '66' }}
                      />
                    </div>

                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100 max-h-52 overflow-y-auto">
                        {filteredTests.length > 0 ? (
                          filteredTests.map((testName, idx) => {
                            const isChecked = selectedTests.includes(testName);
                            return (
                              <label
                                key={idx}
                                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer text-sm transition-colors
                                  ${isChecked ? 'bg-indigo-50' : 'bg-white hover:bg-gray-50'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={isSubmitting}
                                  onChange={() => toggleTest(testName)}
                                  className="w-4 h-4 rounded border-gray-300 flex-shrink-0"
                                  style={{ accentColor: themeColor }}
                                />
                                <span className={`leading-tight ${isChecked ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                                  {testName}
                                </span>
                              </label>
                            );
                          })
                        ) : (
                          <p className="col-span-2 text-center text-sm text-gray-400 italic py-6">
                            {testSearch ? `No tests matching "${testSearch}"` : 'No tests configured for this lab'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Selected tags */}
                    {selectedTests.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {selectedTests.map((t) => (
                          <span
                            key={t}
                            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full text-white"
                            style={{ backgroundColor: themeColor }}
                          >
                            {t}
                            <button type="button" onClick={() => toggleTest(t)} className="ml-0.5 hover:opacity-70">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {errors.tests && (
                      <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />{errors.tests}
                      </p>
                    )}
                  </div>

                  {/* Date + Booking Type */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>
                        <Calendar className="inline w-3 h-3 mr-1 -mt-0.5" />Appointment Date <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.appointment_date}
                        disabled={isSubmitting}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setFormData((prev) => ({ ...prev, appointment_date: e.target.value }))}
                        onBlur={() => handleBlur('appointment_date')}
                        className={errors.appointment_date ? fieldClassError : fieldClass}
                      />
                      {errors.appointment_date && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />{errors.appointment_date}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>
                        <Building2 className="inline w-3 h-3 mr-1 -mt-0.5" />Booking Type
                      </label>
                      <div className="flex rounded-lg border border-gray-200 overflow-hidden h-[42px]">
                        {(['walk-in', 'home'] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => setFormData((prev) => ({ ...prev, booking_type: type }))}
                            className={`flex-1 text-xs font-semibold transition-all
                              ${formData.booking_type === type
                                ? 'text-white'
                                : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                            style={formData.booking_type === type ? { backgroundColor: themeColor } : {}}
                          >
                            {type === 'walk-in' ? (
                              <><Building2 className="inline w-3 h-3 mr-1" />Walk-in</>
                            ) : (
                              <><Home className="inline w-3 h-3 mr-1" />Home</>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Time slots */}
                  <div>
                    <label className={labelClass}>
                      <Clock className="inline w-3 h-3 mr-1 -mt-0.5" />Time Slot <span className="text-red-400">*</span>
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-36 overflow-y-auto p-1">
                      {TIME_SLOTS.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, time: slot }));
                            if (errors.time) setErrors((prev) => ({ ...prev, time: '' }));
                          }}
                          className={`px-1.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all
                            ${formData.time === slot
                              ? 'text-white border-transparent shadow-sm'
                              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}
                          style={formData.time === slot ? { backgroundColor: themeColor, borderColor: themeColor } : {}}
                        >
                          {formatSlot(slot)}
                        </button>
                      ))}
                    </div>
                    {errors.time && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />{errors.time}
                      </p>
                    )}
                  </div>

                  {/* Status + Prescription */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>
                        <ClipboardCheck className="inline w-3 h-3 mr-1 -mt-0.5" />Status
                      </label>
                      <select
                        value={formData.status}
                        disabled={isSubmitting}
                        onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as any }))}
                        className={fieldClass}
                        style={{ appearance: 'auto' }}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>
                        <Upload className="inline w-3 h-3 mr-1 -mt-0.5" />Prescription
                      </label>
                      <label className={`flex items-center gap-2 px-3 py-2.5 border-2 border-dashed rounded-lg cursor-pointer transition-colors text-sm
                        ${isSubmitting ? 'opacity-50 pointer-events-none bg-gray-50' : 'hover:bg-gray-50 border-gray-200 text-gray-500'}`}>
                        <Upload className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate text-xs">
                          {prescriptionFileName || 'Upload image or PDF'}
                        </span>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          disabled={isSubmitting}
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                      {/* Preview: image or PDF badge */}
                      {prescriptionFile && (
                        <div className="flex items-center gap-2 mt-1.5">
                          {prescriptionPreview ? (
                            <img src={prescriptionPreview} alt="Preview" className="w-8 h-8 object-cover rounded border" />
                          ) : (
                            <div className="w-8 h-8 bg-red-50 border border-red-200 rounded flex items-center justify-center">
                              <FileText className="w-4 h-4 text-red-500" />
                            </div>
                          )}
                          <span className="text-[11px] text-gray-500 truncate flex-1">{prescriptionFileName}</span>
                          {!isSubmitting && (
                            <button
                              type="button"
                              onClick={() => { setPrescriptionFile(null); setPrescriptionPreview(null); setPrescriptionFileName(''); }}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                      {errors.prescription && (
                        <p className="text-xs text-red-500 mt-1">{errors.prescription}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ STEP 3: Logistics ═══ */}
              {activeStep === 3 && (
                <div className="space-y-4">
                  {formData.booking_type === 'home' && (
                    <>
                      <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <Home className="w-3.5 h-3.5 flex-shrink-0" />
                        Home collection — address details required
                      </div>

                      <div>
                        <label className={labelClass}>
                          <MapPin className="inline w-3 h-3 mr-1 -mt-0.5" />Address Line <span className="text-red-400">*</span>
                        </label>
                        <textarea
                          rows={2}
                          value={formData.address_line}
                          disabled={isSubmitting}
                          onChange={(e) => setFormData((prev) => ({ ...prev, address_line: e.target.value }))}
                          className={errors.address ? fieldClassError : fieldClass}
                          placeholder="House no., street, area…"
                        />
                        {errors.address && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />{errors.address}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>Pincode</label>
                          <input
                            type="text"
                            value={formData.pincode}
                            disabled={isSubmitting}
                            maxLength={6}
                            onChange={(e) => setFormData((prev) => ({ ...prev, pincode: e.target.value }))}
                            className={fieldClass}
                            placeholder="e.g. 781001"
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Landmark</label>
                          <input
                            type="text"
                            value={formData.landmark}
                            disabled={isSubmitting}
                            onChange={(e) => setFormData((prev) => ({ ...prev, landmark: e.target.value }))}
                            className={fieldClass}
                            placeholder="Nearby reference"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {formData.booking_type === 'walk-in' && (
                    <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                      <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                      Walk-in booking — no address required
                    </div>
                  )}

                  <div>
                    <label className={labelClass}>
                      <StickyNote className="inline w-3 h-3 mr-1 -mt-0.5" />Remarks & Internal Notes
                    </label>
                    <textarea
                      rows={3}
                      value={formData.remarks}
                      disabled={isSubmitting}
                      onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
                      className={fieldClass}
                      placeholder="e.g. Fasting required, patient is diabetic…"
                    />
                  </div>

                  {/* Summary card */}
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2.5 text-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Booking Summary</p>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Patient</span>
                      <span className="font-semibold text-gray-800">{formData.name || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Mobile</span>
                      <span className="font-medium text-gray-700">{formData.mobile || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tests</span>
                      <span className="font-medium text-gray-700 text-right max-w-[55%]">
                        {selectedTests.length > 0 ? selectedTests.join(', ') : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Date & Time</span>
                      <span className="font-medium text-gray-700">
                        {formData.appointment_date
                          ? `${formData.appointment_date}${formData.time ? ' · ' + formatSlot(formData.time) : ''}`
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Type</span>
                      <span className="font-medium text-gray-700 capitalize">{formData.booking_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status</span>
                      <span className={`font-semibold text-xs px-2 py-0.5 rounded-full
                        ${formData.status === 'Confirmed' ? 'bg-green-100 text-green-700'
                          : formData.status === 'Pending' ? 'bg-yellow-100 text-yellow-700'
                          : formData.status === 'Cancelled' ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'}`}>
                        {formData.status}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── FOOTER NAV ── */}
            <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100 bg-white flex-shrink-0">
              <button
                type="button"
                disabled={activeStep === 1 || isSubmitting}
                onClick={() => setActiveStep((p) => p - 1)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />Back
              </button>

              {activeStep < 3 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90"
                  style={{ backgroundColor: themeColor }}
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white rounded-lg shadow transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: themeColor }}
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                  ) : (
                    <><CheckCircle className="w-4 h-4" />Register Appointment</>
                  )}
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
