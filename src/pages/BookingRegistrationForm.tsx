import React, { useState, useEffect, useCallback } from 'react';
import { 
  User, Phone, Mail, Calendar, Clock, Beaker, MapPin, 
  AlertCircle, CheckCircle, Upload, X, 
  Loader2, ChevronRight, Stethoscope
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
  booking_type: 'walk-in' | 'home'; // Matched perfectly to CHECK CONSTRAINT array values
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

export const BookingRegistrationForm: React.FC<BookingRegistrationFormProps> = ({ 
  onSuccess, 
  onCancel,
  currentLabId = "LAB-001",
  isOpen = true
}) => {
  const [labInfo, setLabInfo] = useState<LabData | null>(null);
  const [dynamicTests, setDynamicTests] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    whatsapp: '',
    email: '',
    age: '',
    gender: '' as 'Male' | 'Female' | 'Other' | '',
    appointment_date: '',
    time: '',
    status: 'Pending' as const,
    remarks: '',
    booking_type: 'walk-in' as 'walk-in' | 'home', // Standardized options
    address_line: '',
    pincode: '',
    landmark: ''
  });

  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [prescriptionPreview, setPrescriptionPreview] = useState<string | null>(null);

  // Safe Helper to parse test references dynamically from strings or objects inside JSONB array
  const getTestStringValue = (item: any): string => {
    if (!item) return '';
    if (typeof item === 'string') return item;
    if (typeof item === 'object') {
      return item.name || item.test_name || item.title || JSON.stringify(item);
    }
    return String(item);
  };

  // Fetch Lab configuration and populate the tests checklist dynamically
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
          
          // Parse out the items inside the jsonb column safely
          if (Array.isArray(data.available_tests)) {
            const parsedTests = data.available_tests
              .map(item => getTestStringValue(item))
              .filter(name => name.trim() !== '');
            setDynamicTests(parsedTests);
          } else {
            setDynamicTests([]);
          }
        }
      } catch (err) {
        console.error("Error fetching available_tests from labs table:", err);
        setLabInfo({ id: currentLabId, lab_name: "Diagnostic Lab Workspace" });
        setDynamicTests([]);
      }
    };

    if (isOpen) {
      fetchLabLogics();
    }
  }, [currentLabId, isOpen]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, prescription: 'File size must be under 5MB' }));
        return;
      }
      setPrescriptionPreview(URL.createObjectURL(file));
      setPrescriptionFile(file);
      setErrors(prev => ({ ...prev, prescription: '' }));
    }
  }, []);

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};
    
    if (!formData.name.trim()) newErrors.name = 'Patient name is required';
    if (!formData.mobile.match(/^[0-9]{10}$/)) newErrors.mobile = 'Valid 10-digit mobile number required';
    if (!formData.age || parseInt(formData.age) < 0 || parseInt(formData.age) > 120) newErrors.age = 'Valid age required';
    if (!formData.gender) newErrors.gender = 'Gender is required';
    if (!formData.appointment_date) newErrors.appointment_date = 'Date required';
    if (!formData.time) newErrors.time = 'Time required';
    if (selectedTests.length === 0) newErrors.tests = 'Select at least one test';
    
    if (formData.booking_type === 'home' && !formData.address_line.trim()) {
      newErrors.address = 'Address layout is required for Home Collection';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const toggleTest = (testName: string) => {
    setSelectedTests(prev => 
      prev.includes(testName) ? prev.filter(t => t !== testName) : [...prev, testName]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
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
        booking_id: `BK-${Date.now().toString().slice(-6)}`,
        status: formData.status,
        is_deleted: false,
        deleted_at: null,
        remarks: formData.remarks,
        lab_id: currentLabId,
        prescription_url: finalPrescriptionUrl,
        booking_type: formData.booking_type, // Passes 'walk-in' or 'home' perfectly to SQL row instance
        address_line: formData.booking_type === 'home' ? formData.address_line : '',
        pincode: formData.booking_type === 'home' ? formData.pincode : '',
        landmark: formData.booking_type === 'home' ? formData.landmark : ''
      };

      const { data, error: dbError } = await supabase
        .from('appointments')
        .insert([targetPayload])
        .select()
        .single();

      if (dbError) throw dbError;

      setSubmitSuccess(true);
      if (onSuccess) onSuccess(data);

    } catch (err: any) {
      console.error("Database Save Error:", err);
      setErrors(prev => ({ ...prev, global: err.message || "Failed to submit data to row instance." }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { number: 1, title: "Patient Info", icon: User },
    { number: 2, title: "Tests & Schedule", icon: Beaker },
    { number: 3, title: "Logistics Details", icon: MapPin }
  ];

  if (!isOpen) return null;

  const themeColor = labInfo?.theme_color || '#4f46e5';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative max-w-4xl w-full mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Dynamic Header */}
        <div style={{ backgroundColor: themeColor }} className="relative px-8 py-6 text-white">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Stethoscope className="w-6 h-6 text-white/90" />
              <div>
                <h2 className="text-xl font-bold tracking-tight">{labInfo?.lab_name || "Loading Clinic Data..."}</h2>
                <p className="text-xs text-white/70 mt-0.5">Workspace Lab ID: {currentLabId}</p>
              </div>
            </div>
            {onCancel && (
              <button onClick={onCancel} className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Steps */}
          <div className="flex gap-2 mt-6">
            {steps.map(step => (
              <button
                key={step.number}
                type="button"
                onClick={() => setActiveStep(step.number)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeStep === step.number ? 'bg-white text-gray-900 shadow-md' : 'bg-white/10 text-white'
                }`}
              >
                <step.icon className="w-3.5 h-3.5" />
                <span>{step.title}</span>
              </button>
            ))}
          </div>
        </div>

        {errors.global && (
          <div className="m-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errors.global}</span>
          </div>
        )}

        {submitSuccess && (
          <div className="m-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 text-sm font-medium">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Success! Data successfully committed to your database.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-8 max-h-[65vh] overflow-y-auto">
          
          {/* STEP 1: Patient Details */}
          {activeStep === 1 && (
            <div className="space-y-4 animate-[fadeIn_0.2s_ease-out]">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Full Name *</label>
                <input
                  required type="text" value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  placeholder="Patient Name"
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Mobile Primary *</label>
                  <input
                    required type="tel" value={formData.mobile}
                    onChange={(e) => setFormData({...formData, mobile: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                    placeholder="10-digit number"
                  />
                  {errors.mobile && <p className="text-xs text-red-500 mt-1">{errors.mobile}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">WhatsApp Communications</label>
                  <input
                    type="tel" value={formData.whatsapp}
                    onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                    placeholder="Defaults to primary mobile if blank"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Email Address</label>
                <input
                  type="email" value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                  placeholder="name@domain.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Age *</label>
                  <input
                    required type="number" value={formData.age}
                    onChange={(e) => setFormData({...formData, age: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                    placeholder="Years"
                  />
                  {errors.age && <p className="text-xs text-red-500 mt-1">{errors.age}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Gender *</label>
                  <select
                    required value={formData.gender}
                    onChange={(e) => setFormData({...formData, gender: e.target.value as any})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-white"
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Dynamically Fetched JSONB Checklist */}
          {activeStep === 2 && (
            <div className="space-y-5 animate-[fadeIn_0.2s_ease-out]">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">Available Diagnostics *</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-xl bg-gray-50/50">
                  {dynamicTests.length > 0 ? (
                    dynamicTests.map((cleanTestName, index) => (
                      <label key={index} className="flex items-center gap-3 p-2.5 bg-white hover:bg-indigo-50/40 border border-gray-100 rounded-xl text-sm cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedTests.includes(cleanTestName)}
                          onChange={() => toggleTest(cleanTestName)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span className="text-gray-700 font-medium">{cleanTestName}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 p-3 italic col-span-2 text-center">
                      No matching menu lists allocated inside this lab profile config.
                    </p>
                  )}
                </div>
                {errors.tests && <p className="text-xs text-red-500 mt-1">{errors.tests}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Appointment Date *</label>
                  <input
                    required type="date" value={formData.appointment_date}
                    onChange={(e) => setFormData({...formData, appointment_date: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Time Selection *</label>
                  <input
                    required type="time" value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Booking Type</label>
                  <select
                    value={formData.booking_type}
                    onChange={(e) => setFormData({...formData, booking_type: e.target.value as any})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-white"
                  >
                    <option value="walk-in">Walk-in Clinic</option>
                    <option value="home">Home Collection</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Workflow Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-white"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Prescription Document Upload</label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center gap-2 px-4 py-2 border-2 border-dashed rounded-xl cursor-pointer hover:bg-gray-50 text-sm text-gray-600">
                    <Upload className="w-4 h-4 text-gray-400" />
                    <span>Upload to storage bucket</span>
                    <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" />
                  </label>
                  {prescriptionPreview && (
                    <div className="relative">
                      <img src={prescriptionPreview} alt="Preview" className="w-10 h-10 object-cover rounded-lg border" />
                      <button
                        type="button"
                        onClick={() => { setPrescriptionPreview(null); setPrescriptionFile(null); }}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Logistics Setup */}
          {activeStep === 3 && (
            <div className="space-y-4 animate-[fadeIn_0.2s_ease-out]">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Address Line</label>
                <textarea
                  rows={2} value={formData.address_line}
                  onChange={(e) => setFormData({...formData, address_line: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                  placeholder="Required for Home Collection setups"
                />
                {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Pincode</label>
                  <input
                    type="text" value={formData.pincode}
                    onChange={(e) => setFormData({...formData, pincode: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                    placeholder="Postal Code"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Landmark</label>
                  <input
                    type="text" value={formData.landmark}
                    onChange={(e) => setFormData({...formData, landmark: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                    placeholder="Nearby reference point"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">Remarks & Internal Notes</label>
                <textarea
                  rows={2} value={formData.remarks}
                  onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                  placeholder="Additional observations..."
                />
              </div>
            </div>
          )}

          {/* Action Footer Panel */}
          <div className="flex justify-between items-center pt-6 mt-6 border-t border-gray-100">
            <button
              type="button"
              disabled={activeStep === 1}
              onClick={() => setActiveStep(p => p - 1)}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-30"
            >
              Back
            </button>
            
            <div className="flex gap-2">
              {activeStep < 3 ? (
                <button
                  type="button"
                  onClick={() => setActiveStep(p => p + 1)}
                  className="px-5 py-2 text-sm font-medium text-white rounded-xl flex items-center gap-1.5"
                  style={{ backgroundColor: themeColor }}
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 text-sm font-bold text-white rounded-xl shadow-md flex items-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: themeColor }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving to Workspace...
                    </>
                  ) : (
                    "Register Appointment"
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingRegistrationForm;
