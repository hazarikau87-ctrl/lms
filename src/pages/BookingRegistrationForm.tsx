import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  User, Phone, Mail, Calendar, Beaker, MapPin,
  AlertCircle, CheckCircle, Upload, X,
  Loader2, ChevronRight, ChevronLeft, Stethoscope, Search,
  FileText, Hash, MessageCircle, BadgeCheck, CreditCard,
  Home, Building2, StickyNote,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import BillingModule from './BillingModule';

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
  '07:00','07:30','08:00','08:30','09:00','09:30',
  '10:00','10:30','11:00','11:30','12:00','12:30',
  '13:00','13:30','14:00','14:30','15:00','15:30',
  '16:00','16:30','17:00','17:30','18:00','18:30',
  '19:00','19:30','20:00',
];

const formatSlot = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
};

const validateStep1 = (formData: any): ValidationErrors => {
  const e: ValidationErrors = {};
  if (!formData.name.trim()) e.name = 'Patient name is required';
  if (!formData.mobile.match(/^[0-9]{10}$/)) e.mobile = 'Enter a valid 10-digit number';
  if (!formData.age || parseInt(formData.age) < 0 || parseInt(formData.age) > 120)
    e.age = 'Enter age between 0 and 120';
  if (!formData.gender) e.gender = 'Select a gender';
  return e;
};

const validateStep2 = (formData: any, selectedTests: string[]): ValidationErrors => {
  const e: ValidationErrors = {};
  if (selectedTests.length === 0) e.tests = 'Select at least one test';
  if (!formData.appointment_date) e.appointment_date = 'Appointment date is required';
  if (!formData.time) e.time = 'Select a time slot';
  return e;
};

const validateStep3 = (formData: any): ValidationErrors => {
  const e: ValidationErrors = {};
  if (formData.booking_type === 'home' && !formData.address_line.trim())
    e.address_line = 'Address is required for home collection';
  return e;
};

const input =
  'w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 ' +
  'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ' +
  'focus:border-indigo-400 transition-all disabled:bg-slate-50 disabled:text-slate-400';

const inputError =
  'w-full px-3.5 py-2.5 bg-white border border-red-400 rounded-xl text-sm text-slate-800 ' +
  'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-300/30 ' +
  'focus:border-red-400 transition-all';

const label = 'block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5';

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5 font-medium">
      <AlertCircle className="w-3 h-3 flex-shrink-0" />
      {msg}
    </p>
  );
}

function InputWrapper({ children }: { children: React.ReactNode }) {
  return <div className="relative">{children}</div>;
}

function InputIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
      {children}
    </p>
  );
}

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
  const [prescriptionFileName, setPrescriptionFileName] = useState('');
  const [showBilling, setShowBilling] = useState(false);
  const [billingComplete, setBillingComplete] = useState(false);
  const isProcessingPayload = useRef(false);

  const getTestStringValue = (item: any): string => {
    if (!item) return '';
    if (typeof item === 'string') return item;
    if (typeof item === 'object')
      return item.name || item.test_name || item.title || JSON.stringify(item);
    return String(item);
  };

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
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
            setDynamicTests(
              data.available_tests.map(getTestStringValue).filter((n) => n.trim() !== '')
            );
          }
        }
      } catch {
        setLabInfo({ id: currentLabId, lab_name: 'Diagnostic Lab' });
      }
    })();
  }, [currentLabId, isOpen]);

  useEffect(() => {
    if (whatsappSameAsMobile) setFormData((p) => ({ ...p, whatsapp: p.mobile }));
  }, [formData.mobile, whatsappSameAsMobile]);

  const touch = (field: string) => {
    setTouchedFields((p) => new Set(p).add(field));
    setErrors((p) => ({ ...p, [field]: validateStep1(formData)[field] || '' }));
  };

  const f = (key: string) => ({
    id: key,
    name: key,
    value: (formData as any)[key],
    disabled: isSubmitting || submitSuccess,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setFormData((p) => ({ ...p, [key]: e.target.value })),
    onBlur: () => touch(key),
    className: errors[key] && touchedFields.has(key) ? inputError : input,
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrors((p) => ({ ...p, prescription: 'File must be under 5 MB' }));
      return;
    }
    setPrescriptionFileName(file.name);
    setPrescriptionFile(file);
    setErrors((p) => ({ ...p, prescription: '' }));
  }, []);

  const toggleTest = (name: string) => {
    setSelectedTests((p) => p.includes(name) ? p.filter((t) => t !== name) : [...p, name]);
    if (errors.tests) setErrors((p) => ({ ...p, tests: '' }));
  };

  const handleNext = () => {
    const errs =
      activeStep === 1 ? validateStep1(formData)
      : activeStep === 2 ? validateStep2(formData, selectedTests)
      : validateStep3(formData);
    if (Object.keys(errs).length > 0) {
      setErrors((p) => ({ ...p, ...errs }));
      setTouchedFields((p) => {
        const next = new Set(p);
        Object.keys(errs).forEach((k) => next.add(k));
        return next;
      });
      return;
    }
    setActiveStep((p) => p + 1);
  };

  const validateForm = () => {
    const all = {
      ...validateStep1(formData),
      ...validateStep2(formData, selectedTests),
      ...validateStep3(formData),
    };
    setErrors(all);
    return Object.keys(all).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessingPayload.current || isSubmitting || submitSuccess) return;
    if (!validateForm()) return;

    isProcessingPayload.current = true;
    setIsSubmitting(true);
    let finalPrescriptionUrl = '';

    try {
      if (prescriptionFile) {
        const ext = prescriptionFile.name.split('.').pop();
        const path = `${currentLabId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('prescriptions')
          .upload(path, prescriptionFile);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('prescriptions').getPublicUrl(path);
        finalPrescriptionUrl = urlData.publicUrl;
      }

      const generatedBookingId = `BK-${Date.now().toString().slice(-6)}`;
      const payload = {
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

      const { data, error: dbError } = await supabase
        .from('appointments')
        .insert([payload])
        .select()
        .single();

      if (dbError) throw dbError;

      setSavedBookingId(generatedBookingId);
      setSavedAppointmentId(data.id as number);
      setSubmitSuccess(true);
      setIsSubmitting(false);

      onSuccess?.(data);
    } catch (err: any) {
      setErrors((p) => ({ ...p, global: err.message || 'Failed to save. Please try again.' }));
      isProcessingPayload.current = false;
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    handleReset();
    onCancel?.();
  };

  const handleBillingComplete = () => {
    setBillingComplete(true);
    setTimeout(handleClose, 1500);
  };

  const handleReset = () => {
    setFormData({
      name: '', mobile: '', whatsapp: '', email: '', age: '', gender: '',
      appointment_date: '', time: '', status: 'Pending', remarks: '',
      booking_type: 'walk-in', address_line: '', pincode: '', landmark: '',
    });
    setSelectedTests([]);
    setErrors({});
    setTouchedFields(new Set());
    setIsSubmitting(false);
    setSubmitSuccess(false);
    setSavedBookingId('');
    setSavedAppointmentId(null);
    setPrescriptionFile(null);
    setPrescriptionFileName('');
    setWhatsappSameAsMobile(false);
    setTestSearch('');
    setActiveStep(1);
    setShowBilling(false);
    setBillingComplete(false);
    isProcessingPayload.current = false;
  };

  const themeColor = labInfo?.theme_color || '#4f46e5';
  const filteredTests = dynamicTests.filter((t) =>
    t.toLowerCase().includes(testSearch.toLowerCase())
  );
  const steps = [
    { number: 1, label: 'Patient', icon: User },
    { number: 2, label: 'Tests', icon: Beaker },
    { number: 3, label: 'Details', icon: MapPin },
  ];

  if (!isOpen) return null;

  const progressPct = ((activeStep - 1) / (steps.length - 1)) * 100;

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">

      {/* HEADER */}
      <div className="px-6 pt-5 pb-0 text-white" style={{ backgroundColor: themeColor }}>
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight leading-snug">
                {labInfo?.lab_name || 'Loading…'}
              </h2>
              <p className="text-[11px] text-white/50 mt-0.5">New patient registration</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 mb-0">
          {steps.map((step, idx) => {
            const isActive = activeStep === step.number;
            const isDone = activeStep > step.number;
            return (
              <React.Fragment key={step.number}>
                <button
                  type="button"
                  disabled={isSubmitting || step.number >= activeStep}
                  onClick={() => { if (step.number < activeStep) setActiveStep(step.number); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all select-none
                    ${isActive ? 'bg-white text-slate-800 shadow-sm'
                      : isDone ? 'bg-white/20 text-white cursor-pointer hover:bg-white/30'
                      : 'bg-white/8 text-white/50 cursor-default'}`}
                >
                  {isDone
                    ? <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    : <step.icon className="w-3 h-3 flex-shrink-0" />}
                  {step.label}
                </button>
                {idx < steps.length - 1 && <div className="flex-1 h-px bg-white/15 mx-0.5" />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="mt-4 h-0.5 bg-white/15 -mx-6">
          <div
            className="h-full bg-white/60 transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* GLOBAL ERROR */}
      {errors.global && (
        <div className="mx-5 mt-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2.5 text-xs font-medium">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          {errors.global}
        </div>
      )}

      {/* RENDER FORM SO IT STAYS ALIVE */}
      <form onSubmit={handleSubmit} autoComplete="on">
        <div className="px-6 py-5 space-y-5">

          {activeStep === 1 && (
            <div className="space-y-4">
              <SectionLabel>Patient details</SectionLabel>
              <div>
                <label htmlFor="name" className={label}>Full name <span className="text-red-400 normal-case tracking-normal">*</span></label>
                <InputWrapper>
                  <InputIcon><User className="w-4 h-4" /></InputIcon>
                  <input id="name" name="name" type="text" autoComplete="name" placeholder="e.g. Rahul Sharma"
                    {...f('name')} className={`${errors.name && touchedFields.has('name') ? inputError : input} pl-10`} />
                </InputWrapper>
                <FieldError msg={touchedFields.has('name') ? errors.name : ''} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="mobile" className={label}>Mobile <span className="text-red-400 normal-case tracking-normal">*</span></label>
                  <InputWrapper>
                    <InputIcon><Phone className="w-4 h-4" /></InputIcon>
                    <input id="mobile" name="mobile" type="tel" autoComplete="tel" placeholder="10-digit number"
                      {...f('mobile')} className={`${errors.mobile && touchedFields.has('mobile') ? inputError : input} pl-10`} />
                  </InputWrapper>
                  <FieldError msg={touchedFields.has('mobile') ? errors.mobile : ''} />
                </div>
                <div>
                  <label htmlFor="whatsapp" className={label}>WhatsApp</label>
                  <InputWrapper>
                    <InputIcon><MessageCircle className="w-4 h-4" /></InputIcon>
                    <input id="whatsapp" name="whatsapp" type="tel" autoComplete="tel"
                      placeholder={whatsappSameAsMobile ? 'Copied from mobile' : 'Optional'}
                      value={whatsappSameAsMobile ? formData.mobile : formData.whatsapp}
                      disabled={isSubmitting || submitSuccess || whatsappSameAsMobile}
                      onChange={(e) => setFormData((p) => ({ ...p, whatsapp: e.target.value }))}
                      className={`${input} pl-10 ${whatsappSameAsMobile ? 'bg-slate-50 text-slate-400' : ''}`} />
                  </InputWrapper>
                  <label htmlFor="whatsapp-same" className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                    <input id="whatsapp-same" type="checkbox" checked={whatsappSameAsMobile}
                      onChange={(e) => setWhatsappSameAsMobile(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-[11px] text-slate-500 font-medium">Same as mobile</span>
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="email" className={label}>Email</label>
                <InputWrapper>
                  <InputIcon><Mail className="w-4 h-4" /></InputIcon>
                  <input id="email" name="email" type="email" autoComplete="email" placeholder="patient@example.com"
                    {...f('email')} className={`${input} pl-10`} />
                </InputWrapper>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="age" className={label}>Age <span className="text-red-400 normal-case tracking-normal">*</span></label>
                  <input id="age" name="age" type="number" autoComplete="off" placeholder="Years" min={0} max={120} {...f('age')} />
                  <FieldError msg={touchedFields.has('age') ? errors.age : ''} />
                </div>
                <div>
                  <label htmlFor="gender" className={label}>Gender <span className="text-red-400 normal-case tracking-normal">*</span></label>
                  <select id="gender" name="gender" autoComplete="sex" {...f('gender')} style={{ appearance: 'auto' }}>
                    <option value="">Select…</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  <FieldError msg={touchedFields.has('gender') ? errors.gender : ''} />
                </div>
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <SectionLabel>Select tests</SectionLabel>
                  {selectedTests.length > 0 && (
                    <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: themeColor }}>
                      {selectedTests.length} selected
                    </span>
                  )}
                </div>
                <InputWrapper>
                  <InputIcon><Search className="w-4 h-4" /></InputIcon>
                  <input id="test-search" type="text" autoComplete="off" placeholder="Search tests…"
                    value={testSearch} onChange={(e) => setTestSearch(e.target.value)}
                    className={`${input} pl-10 mb-2`} />
                </InputWrapper>
                {selectedTests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedTests.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 text-[11px] font-semibold text-white rounded-full" style={{ backgroundColor: themeColor }}>
                        {t}
                        <button type="button" onClick={() => toggleTest(t)}
                          className="w-4 h-4 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors" aria-label={`Remove ${t}`}>
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-44 overflow-y-auto">
                  {filteredTests.length === 0
                    ? <div className="py-8 text-center text-sm text-slate-400">No tests match your search.</div>
                    : <div className="divide-y divide-slate-100">
                        {filteredTests.map((testName, idx) => {
                          const checked = selectedTests.includes(testName);
                          return (
                            <label key={idx} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors text-sm ${checked ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}>
                              <input type="checkbox" checked={checked} onChange={() => toggleTest(testName)}
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0" />
                              <span className={`font-medium ${checked ? 'text-indigo-700' : 'text-slate-700'}`}>{testName}</span>
                            </label>
                          );
                        })}
                      </div>
                  }
                </div>
                <FieldError msg={errors.tests} />
              </div>

              {/* PRESCRIPTION UPLOAD (MOVED TO STEP 2) */}
              <div>
                <SectionLabel>Prescription</SectionLabel>
                {!prescriptionFileName ? (
                  <label htmlFor="prescription-upload"
                    className="flex flex-col items-center justify-center gap-2.5 p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100/60 hover:border-slate-300 transition-all cursor-pointer">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                      <Upload className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-600">Upload prescription</p>
                      <p className="text-xs text-slate-400 mt-0.5">PDF, PNG, JPG · max 5 MB</p>
                    </div>
                    <input id="prescription-upload" type="file" accept="image/*,application/pdf"
                      onChange={handleFileUpload} className="hidden" disabled={isSubmitting} />
                  </label>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200/80 rounded-xl">
                    <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                    <span className="flex-1 text-xs font-semibold text-indigo-700 truncate">{prescriptionFileName}</span>
                    <button type="button" onClick={() => { setPrescriptionFile(null); setPrescriptionFileName(''); }}
                      className="w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-indigo-200 text-indigo-400 hover:text-red-500 hover:border-red-200 transition-colors" aria-label="Remove file">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <FieldError msg={errors.prescription} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="appointment_date" className={label}>Date <span className="text-red-400 normal-case tracking-normal">*</span></label>
                  <InputWrapper>
                    <InputIcon><Calendar className="w-4 h-4" /></InputIcon>
                    <input id="appointment_date" name="appointment_date" type="date" autoComplete="off"
                      min={new Date().toISOString().split('T')[0]}
                      value={formData.appointment_date}
                      onChange={(e) => setFormData((p) => ({ ...p, appointment_date: e.target.value }))}
                      className={`${errors.appointment_date ? inputError : input} pl-10`} />
                  </InputWrapper>
                  <FieldError msg={errors.appointment_date} />
                </div>
                <div>
                  <label className={label}>Collection type</label>
                  <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-slate-50 p-1 gap-1 h-[44px]">
                    {(['walk-in', 'home'] as const).map((mode) => (
                      <button key={mode} type="button" onClick={() => setFormData((p) => ({ ...p, booking_type: mode }))}
                        className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all
                          ${formData.booking_type === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                        {mode === 'walk-in' ? <Building2 className="w-3 h-3" /> : <Home className="w-3 h-3" />}
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className={label}>Time slot <span className="text-red-400 normal-case tracking-normal">*</span></label>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-40 overflow-y-auto p-0.5">
                  {TIME_SLOTS.map((slot) => {
                    const selected = formData.time === slot;
                    return (
                      <button key={slot} type="button" onClick={() => setFormData((p) => ({ ...p, time: slot }))}
                        className={`py-2 text-[11px] font-semibold rounded-lg border transition-all
                          ${selected ? 'text-white border-transparent shadow-sm' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}
                        style={selected ? { backgroundColor: themeColor, borderColor: themeColor } : {}}>
                        {formatSlot(slot)}
                      </button>
                    );
                  })}
                </div>
                <FieldError msg={errors.time} />
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="space-y-5">
              {formData.booking_type === 'home' && (
                <div className="space-y-4 p-4 rounded-xl bg-amber-50/60 border border-amber-200/60">
                  <div className="flex items-center gap-2 mb-1">
                    <Home className="w-3.5 h-3.5 text-amber-600" />
                    <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700">Home collection address</p>
                  </div>
                  <div>
                    <label htmlFor="address_line" className={label}>Address <span className="text-red-400 normal-case tracking-normal">*</span></label>
                    <textarea id="address_line" name="address_line" autoComplete="street-address" rows={2}
                      placeholder="House / flat no., street, area…"
                      value={formData.address_line}
                      onChange={(e) => setFormData((p) => ({ ...p, address_line: e.target.value }))}
                      className={errors.address_line ? inputError : input} />
                    <FieldError msg={errors.address_line} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="pincode" className={label}>Pincode</label>
                      <input id="pincode" name="pincode" type="text" autoComplete="postal-code" placeholder="6-digit PIN"
                        value={formData.pincode} onChange={(e) => setFormData((p) => ({ ...p, pincode: e.target.value }))} className={input} />
                    </div>
                    <div>
                      <label htmlFor="landmark" className={label}>Landmark</label>
                      <input id="landmark" name="landmark" type="text" autoComplete="off" placeholder="Near / opposite…"
                        value={formData.landmark} onChange={(e) => setFormData((p) => ({ ...p, landmark: e.target.value }))} className={input} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER CONTROLS ADJUST DEPENDING ON SUBMISSION STATE */}
        {!submitSuccess ? (
          <div className="sticky bottom-0 flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-white">
            <button type="button" disabled={activeStep === 1 || isSubmitting} onClick={() => setActiveStep((p) => p - 1)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 disabled:opacity-30 transition-colors rounded-lg hover:bg-slate-100">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            <div className="flex items-center gap-1.5">
              {steps.map((s) => (
                <div key={s.number}
                  className={`rounded-full transition-all duration-300 ${s.number === activeStep ? 'w-5 h-1.5' : s.number < activeStep ? 'w-1.5 h-1.5' : 'w-1.5 h-1.5 bg-slate-200'}`}
                  style={s.number <= activeStep ? { backgroundColor: themeColor } : {}} />
              ))}
            </div>

            {activeStep < 3 ? (
              <button type="button" onClick={handleNext}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-opacity hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: themeColor }}>
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="submit" disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
                style={{ backgroundColor: themeColor }}>
                {isSubmitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  : <><CheckCircle className="w-4 h-4" /> Save & bill</>}
              </button>
            )}
          </div>
        ) : null}
      </form>

      {/* OVERLAYING THE BILLING MODULE WITHOUT REMOVING THE FORM DATA */}
      {submitSuccess && savedAppointmentId !== null && (
        <div className="border-t-2 border-slate-100 bg-slate-50/50">
          {!showBilling && !billingComplete && (
            <div className="flex flex-col items-center px-8 py-10 text-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <BadgeCheck className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Appointment saved</h3>
                <p className="text-sm text-slate-500 mt-1">Collect payment now or skip to close.</p>
              </div>
              <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 w-full justify-center">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Booking ID</span>
                <span className="font-mono font-bold text-slate-900 text-sm pl-3 border-l border-slate-200 ml-1">
                  {savedBookingId}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5 w-full">
                <button
                  type="button"
                  onClick={() => setShowBilling(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-white rounded-xl transition-opacity hover:opacity-90 active:scale-[0.98]"
                  style={{ backgroundColor: themeColor }}
                >
                  <CreditCard className="w-3.5 h-3.5" /> Collect payment
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Skip & close
                </button>
              </div>
            </div>
          )}

          {showBilling && !billingComplete && (
            <div className="px-5 py-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 leading-tight">Payment</p>
                    <p className="text-[11px] font-mono text-slate-400">{savedBookingId}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBilling(false)}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-700 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Back
                </button>
              </div>
              <BillingModule
                appointmentId={savedAppointmentId}
                labId={currentLabId}
                selectedTests={selectedTests}
                availableTestsMeta={labInfo?.available_tests || []}
                themeColor={themeColor}
                onPaymentSuccess={handleBillingComplete}
              />
            </div>
          )}

          {billingComplete && (
            <div className="flex flex-col items-center justify-center px-8 py-14 text-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">All done!</h3>
                <p className="text-sm text-slate-500 mt-1">Appointment and payment recorded.</p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5">
                <Hash className="w-3.5 h-3.5 text-emerald-500" />
                <span className="font-mono text-sm font-bold text-emerald-700">{savedBookingId}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BookingRegistrationForm;