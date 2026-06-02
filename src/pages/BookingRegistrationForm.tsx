import React, { useState, useEffect, useCallback } from 'react';
import { 
  User, Phone, Mail, Calendar, Clock, Beaker, MapPin, 
  AlertCircle, CheckCircle, Upload, X, 
  Hash, Loader2, ChevronRight, Home, 
  Globe, Stethoscope, Activity, Heart, Eye, Droplet
} from 'lucide-react';

// ============== SCHEMAS & INTERFACES ==============
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
  prescription_file?: File | null;
  booking_type: 'Walk-in' | 'Home Collection' | 'Online';
  address_line: string;
  pincode: string;
  landmark: string;
}

export interface LabSettingsData {
  id: string;
  created_at?: string;
  lab_name: string;
  slug: string;
  theme_color: string;
  domain: string;
  is_active: boolean;
  email: string;
  phone_number: string;
  whatsapp_number: string;
  logo_url: string;
  tagline: string;
  operating_hours: string;
  available_tests: Array<{
    category: string;
    icon_type: 'Droplet' | 'Activity' | 'Heart' | 'Eye';
    tests: Array<{ code: string; name: string; price: number; duration: string }>;
  }>;
}

interface ValidationErrors {
  [key: string]: string;
}

interface BookingRegistrationFormProps {
  onSuccess?: (data: AppointmentData) => void;
  onCancel?: () => void;
  isOpen?: boolean;
  labSettings?: LabSettingsData; // Made optional to prevent initial parent component load crashes
}

const ICON_MAP = {
  Droplet: Droplet,
  Activity: Activity,
  Heart: Heart,
  Eye: Eye
};

// ============== MAIN COMPONENT ==============
export const BookingRegistrationForm: React.FC<BookingRegistrationFormProps> = ({ 
  onSuccess, 
  onCancel,
  isOpen = true,
  labSettings
}) => {
  // Safe default initialization using optional chaining (?.) and fallbacks
  const [formData, setFormData] = useState<AppointmentData>({
    name: '',
    mobile: '',
    whatsapp: '',
    email: '',
    age: '',
    gender: '',
    appointment_date: '',
    time: '',
    test: '',
    status: 'Pending',
    is_deleted: false,
    deleted_at: null,
    remarks: '',
    lab_id: labSettings?.id || 'LAB-001', // Safe fallback if labSettings is undefined
    prescription_url: '',
    booking_type: 'Walk-in',
    address_line: '',
    pincode: '',
    landmark: ''
  });

  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [prescriptionPreview, setPrescriptionPreview] = useState<string | null>(null);
  const [estimatedTotal, setEstimatedTotal] = useState(0);

  // Sync state if labSettings loads after the component initially mounts
  useEffect(() => {
    if (labSettings?.id) {
      setFormData(prev => ({ ...prev, lab_id: labSettings.id }));
    }
  }, [labSettings?.id]);

  // Handle dynamic price evaluations safely
  useEffect(() => {
    let total = 0;
    if (labSettings?.available_tests) {
      selectedTests.forEach(testCode => {
        for (const cat of labSettings.available_tests) {
          const standardTest = cat.tests.find(t => t.code === testCode);
          if (standardTest) {
            total += standardTest.price;
            break;
          }
        }
      });
    }
    setEstimatedTotal(total);
    setFormData(prev => ({ ...prev, test: selectedTests.join(', ') }));
  }, [selectedTests, labSettings?.available_tests]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, prescription: 'File size must be less than 5MB' }));
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      setPrescriptionPreview(previewUrl);
      setFormData(prev => ({ 
        ...prev, 
        prescription_file: file,
        prescription_url: `/uploads/${labSettings?.slug || 'generic'}/prescriptions/${file.name}` 
      }));
      setErrors(prev => ({ ...prev, prescription: '' }));
    }
  }, [labSettings?.slug]);

  // Early load/loading screen if lab settings data hasn't arrived from API yet
  if (!labSettings) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-3 max-w-sm w-full text-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-sm font-medium text-gray-600">Loading diagnostic terminal configs...</p>
        </div>
      </div>
    );
  }

  // Gracefully handle deactivated labs
  if (!labSettings.is_active) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-xl max-w-sm text-center shadow-xl">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-900">Lab Offline</h3>
          <p className="text-sm text-gray-500 mt-1">This diagnostic terminal is currently disabled.</p>
        </div>
      </div>
    );
  }

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Patient name is required';
    if (!formData.mobile.match(/^[0-9]{10}$/)) newErrors.mobile = 'Valid 10-digit mobile number required';
    if (!formData.age || parseInt(formData.age) < 0 || parseInt(formData.age) > 120) newErrors.age = 'Valid age required';
    if (!formData.gender) newErrors.gender = 'Gender is required';
    if (!formData.appointment_date) newErrors.appointment_date = 'Appointment date required';
    if (!formData.time) newErrors.time = 'Appointment time required';
    if (selectedTests.length === 0) newErrors.tests = 'At least one test must be selected';
    if (formData.booking_type === 'Home Collection' && !formData.address_line.trim()) {
      newErrors.address = 'Address line required for home collection';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const toggleTest = (testCode: string) => {
    setSelectedTests(prev => 
      prev.includes(testCode) ? prev.filter(t => t !== testCode) : [...prev, testCode]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    const executionData: AppointmentData = {
      ...formData,
      id: `APT-${Math.floor(100000 + Math.random() * 900000)}`,
      booking_id: `BK-${Date.now().toString().slice(-8)}`,
      created_at: new Date().toISOString()
    };
    
    setSubmitSuccess(true);
    setTimeout(() => {
      if (onSuccess) onSuccess(executionData);
      setIsSubmitting(false);
    }, 1000);
  };

  const steps = [
    { number: 1, title: "Patient Info", icon: User },
    { number: 2, title: "Test Selection", icon: Beaker },
    { number: 3, title: "Schedule", icon: Calendar },
    { number: 4, title: "Location / Remarks", icon: MapPin }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative max-w-5xl w-full mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden animate-[fadeIn_0.3s_ease-out]">
        
        <div 
          className="relative px-8 py-6 transition-all"
          style={{ backgroundColor: labSettings.theme_color || '#4f46e5' }}
        >
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative flex justify-between items-center">
            <div className="flex items-center gap-4">
              {labSettings.logo_url ? (
                <img 
                  src={labSettings.logo_url} 
                  alt={labSettings.lab_name} 
                  className="w-12 h-12 rounded-xl object-cover bg-white p-1 shadow"
                />
              ) : (
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Stethoscope className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">{labSettings.lab_name}</h2>
                <p className="text-white/80 text-xs italic mt-0.5">{labSettings.tagline || 'Premium Diagnostics Terminal'}</p>
                <p className="text-white/60 text-xs mt-1">Hours: {labSettings.operating_hours}</p>
              </div>
            </div>
            {onCancel && (
              <button 
                onClick={onCancel}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-all flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <div className="flex gap-2 mt-6">
            {steps.map(step => (
              <button
                key={step.number}
                type="button"
                onClick={() => setActiveStep(step.number)}
                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                  activeStep === step.number 
                    ? 'bg-white shadow-lg text-gray-900 font-semibold' 
                    : activeStep > step.number 
                      ? 'bg-white/20 text-white' 
                      : 'bg-white/10 text-white/70'
                }`}
              >
                <step.icon className="w-4 h-4" />
                <span className="text-xs font-medium hidden sm:inline">{step.title}</span>
              </button>
            ))}
          </div>
        </div>

        {submitSuccess && (
          <div className="m-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="font-semibold text-emerald-800">Booking Pipeline Synced!</p>
              <p className="text-sm text-emerald-600">The scheduled records have requested persistent entry on domain context {labSettings.domain}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-8 max-h-[65vh] overflow-y-auto custom-scrollbar">
          
          {/* STEP 1: Patient Information */}
          {activeStep === 1 && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Patient Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className={`w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-gray-400 transition-all ${
                        errors.name ? 'border-red-300 bg-red-50' : 'border-gray-200'
                      }`}
                      placeholder="Enter patient full name"
                    />
                  </div>
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Primary Phone *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required
                      type="tel"
                      value={formData.mobile}
                      onChange={(e) => setFormData({...formData, mobile: e.target.value})}
                      className={`w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 ${
                        errors.mobile ? 'border-red-300 bg-red-50' : 'border-gray-200'
                      }`}
                      placeholder="10 digit contact identifier"
                    />
                  </div>
                  {errors.mobile && <p className="text-xs text-red-500 mt-1">{errors.mobile}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">WhatsApp Route Link</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl"
                      placeholder={`Default fallback: ${labSettings.whatsapp_number}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl"
                      placeholder="patient@medicalrecords.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Age Context *</label>
                  <input
                    required
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({...formData, age: e.target.value})}
                    className={`w-full px-4 py-2.5 border rounded-xl ${
                      errors.age ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                    placeholder="Years"
                  />
                  {errors.age && <p className="text-xs text-red-500 mt-1">{errors.age}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Gender Category *</label>
                  <select
                    required
                    value={formData.gender}
                    onChange={(e) => setFormData({...formData, gender: e.target.value as any})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Diagnostic Catalog */}
          {activeStep === 2 && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {labSettings.available_tests?.map((cat) => {
                  const ResolvedIcon = ICON_MAP[cat.icon_type] || Beaker;
                  return (
                    <div key={cat.category} className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center gap-2">
                        <ResolvedIcon className="w-4 h-4 text-gray-600" />
                        <h3 className="font-semibold text-gray-800 text-sm">{cat.category}</h3>
                      </div>
                      <div className="p-2 space-y-1">
                        {cat.tests?.map(t => (
                          <label
                            key={t.code}
                            className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all ${
                              selectedTests.includes(t.code) ? 'bg-gray-50 border border-gray-300' : 'hover:bg-gray-50/50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={selectedTests.includes(t.code)}
                                onChange={() => toggleTest(t.code)}
                                className="rounded text-gray-800 focus:ring-0 w-4 h-4"
                              />
                              <div>
                                <span className="text-xs font-bold bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded mr-2">{t.code}</span>
                                <span className="text-sm font-medium text-gray-800">{t.name}</span>
                                <p className="text-xs text-gray-400 mt-0.5">TAT: {t.duration}</p>
                              </div>
                            </div>
                            <p className="text-sm font-bold text-gray-900">₹{t.price}</p>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedTests.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Consolidated Pipeline Diagnostics</p>
                    <p className="text-sm font-mono text-gray-700 bg-white px-2 py-1 rounded border mt-1 inline-block">{formData.test}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Gross Price Evaluation</p>
                    <p className="text-2xl font-black text-gray-900">₹{estimatedTotal}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Workflow Scheduling Setup */}
          {activeStep === 3 && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Booking Pathway Variant *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Walk-in', 'Home Collection', 'Online'].map(variant => (
                      <button
                        key={variant}
                        type="button"
                        onClick={() => setFormData({...formData, booking_type: variant as any})}
                        className={`py-3 rounded-xl border font-medium text-xs transition-all ${
                          formData.booking_type === variant
                            ? 'bg-gray-900 text-white border-gray-900 shadow'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {variant}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Appointment Allocation Date *</label>
                  <input
                    required
                    type="date"
                    value={formData.appointment_date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setFormData({...formData, appointment_date: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Target Time Window *</label>
                  <input
                    required
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Clinical Prescription URL Routing</label>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 text-sm text-gray-500">
                      <Upload className="w-4 h-4 text-gray-400" />
                      <span>Select local attachment to index dynamically under lab slug configuration context</span>
                      <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" />
                    </label>
                    {prescriptionPreview && (
                      <div className="relative border p-1 rounded-lg bg-white">
                        <img src={prescriptionPreview} alt="Preview Matrix" className="w-12 h-12 object-cover rounded" />
                        <button
                          type="button"
                          onClick={() => {
                            setPrescriptionPreview(null);
                            setFormData(prev => ({ ...prev, prescription_file: null, prescription_url: '' }));
                          }}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-800 text-white rounded-full flex items-center justify-center text-[9px]"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Geographic Properties & Contextual Remarks */}
          {activeStep === 4 && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Geographic Address Details</label>
                  <textarea
                    rows={2}
                    value={formData.address_line}
                    onChange={(e) => setFormData({...formData, address_line: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                    placeholder="Provide detailed home location structural variables if home sample allocation pathway is checked"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Postal Pincode</label>
                  <input
                    type="text"
                    value={formData.pincode}
                    onChange={(e) => setFormData({...formData, pincode: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                    placeholder="6-digit verification code"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Landmark Reference</label>
                  <input
                    type="text"
                    value={formData.landmark}
                    onChange={(e) => setFormData({...formData, landmark: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                    placeholder="Nearby milestone markers"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Patient History Notes & Case Remarks</label>
                  <textarea
                    rows={3}
                    value={formData.remarks}
                    onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"
                    placeholder="Enter generic system case record notes here..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Execution Pipeline Controls */}
          <div className="flex justify-between items-center pt-6 mt-6 border-t border-gray-100">
            {activeStep > 1 ? (
              <button
                type="button"
                onClick={() => setActiveStep(prev => prev - 1)}
                className="px-5 py-2 border border-gray-200 text-gray-700 text-xs font-medium rounded-xl hover:bg-gray-50"
              >
                Back
              </button>
            ) : <div />}
            
            <div className="flex gap-2">
              {activeStep < 4 ? (
                <button
                  type="button"
                  onClick={() => setActiveStep(prev => prev + 1)}
                  className="px-5 py-2 text-white text-xs font-medium rounded-xl flex items-center gap-1"
                  style={{ backgroundColor: labSettings.theme_color || '#4f46e5' }}
                >
                  Continue Workflow <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-gray-900 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Registering Database Row Ledger...
                    </>
                  ) : (
                    <>Commit Registration Entry</>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.99); }
          to { opacity: 1; transform: scale(1); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 99px; }
      `}</style>
    </div>
  );
};

export default BookingRegistrationForm;
