import React, { useState, useEffect, useCallback } from 'react';
import { 
  User, Phone, Mail, Calendar, Clock, Beaker, MapPin, 
  AlertCircle, CheckCircle, Upload, X, 
  Hash, Loader2, ChevronRight, Home, 
  Globe, Stethoscope, Activity, Heart, Eye, Droplet
} from 'lucide-react';

// ============== TYPES & INTERFACES ==============
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
  prescription_file?: File | null; // Tracked locally for upload processing
  booking_type: 'Walk-in' | 'Home Collection' | 'Online';
  address_line: string;
  pincode: string;
  landmark: string;
}

interface ValidationErrors {
  [key: string]: string;
}

interface BookingRegistrationFormProps {
  onSuccess?: (data: AppointmentData) => void;
  onCancel?: () => void;
  currentLabId?: string;
  labName?: string;
  isOpen?: boolean;
}

// ============== PREMIUM TEST OPTIONS ==============
const PREMIUM_TESTS = [
  { 
    category: "Hematology", 
    icon: Droplet,
    tests: [
      { code: "CBC", name: "Complete Blood Count", price: 499, duration: "4 hrs" },
      { code: "ESR", name: "Erythrocyte Sedimentation Rate", price: 199, duration: "2 hrs" },
      { code: "BTCT", name: "Bleeding Time/Clotting Time", price: 299, duration: "1 hr" }
    ]
  },
  { 
    category: "Biochemistry", 
    icon: Activity,
    tests: [
      { code: "FBS", name: "Fasting Blood Sugar", price: 149, duration: "2 hrs" },
      { code: "PPBS", name: "Post Prandial Blood Sugar", price: 149, duration: "2 hrs" },
      { code: "HBA1C", name: "HbA1c", price: 399, duration: "6 hrs" },
      { code: "LFT", name: "Liver Function Test", price: 799, duration: "8 hrs" },
      { code: "KFT", name: "Kidney Function Test", price: 699, duration: "8 hrs" },
      { code: "LIPID", name: "Lipid Profile", price: 599, duration: "8 hrs" }
    ]
  },
  { 
    category: "Thyroid", 
    icon: Activity,
    tests: [
      { code: "TSH", name: "Thyroid Stimulating Hormone", price: 299, duration: "6 hrs" },
      { code: "T3", name: "Triiodothyronine", price: 399, duration: "6 hrs" },
      { code: "T4", name: "Thyroxine", price: 399, duration: "6 hrs" }
    ]
  },
  { 
    category: "Cardiac", 
    icon: Heart,
    tests: [
      { code: "TROP", name: "Troponin I", price: 899, duration: "2 hrs" },
      { code: "CPK", name: "Creatine Phosphokinase", price: 499, duration: "4 hrs" }
    ]
  },
  { 
    category: "Vitamins", 
    icon: Eye,
    tests: [
      { code: "B12", name: "Vitamin B12", price: 899, duration: "24 hrs" },
      { code: "D3", name: "Vitamin D3", price: 1199, duration: "24 hrs" }
    ]
  }
];

// ============== MAIN COMPONENT ==============
export const BookingRegistrationForm: React.FC<BookingRegistrationFormProps> = ({ 
  onSuccess, 
  onCancel,
  currentLabId = "LAB-001",
  labName = "Diagnostic Lab",
  isOpen = true
}) => {
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
    lab_id: currentLabId,
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

  // Calculate estimated total and join tests into string
  useEffect(() => {
    let total = 0;
    selectedTests.forEach(testCode => {
      for (const category of PREMIUM_TESTS) {
        const test = category.tests.find(t => t.code === testCode);
        if (test) {
          total += test.price;
          break;
        }
      }
    });
    setEstimatedTotal(total);
    setFormData(prev => ({ ...prev, test: selectedTests.join(', ') }));
  }, [selectedTests]);

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, prescription: 'File size must be less than 5MB' }));
        return;
      }
      
      const previewUrl = URL.createObjectURL(file);
      setPrescriptionPreview(previewUrl);
      
      // Update local file and set sample/mock string for database column mapping
      setFormData(prev => ({ 
        ...prev, 
        prescription_file: file,
        prescription_url: `/uploads/prescriptions/${file.name}` 
      }));
      setErrors(prev => ({ ...prev, prescription: '' }));
    }
  }, []);

  // Validate form
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

  // Handle test selection toggle
  const toggleTest = (testCode: string) => {
    setSelectedTests(prev => 
      prev.includes(testCode) 
        ? prev.filter(t => t !== testCode)
        : [...prev, testCode]
    );
  };

  // Handle form execution
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    
    setIsSubmitting(true);
    
    // Simulating endpoint delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const finalSubmissionData: AppointmentData = {
      ...formData,
      id: `APT-${Math.floor(100000 + Math.random() * 900000)}`,
      booking_id: `BK-${Date.now().toString().slice(-8)}`,
      created_at: new Date().toISOString()
    };
    
    console.log("Submitting Appointment exactly to schema mapping:", finalSubmissionData);
    setSubmitSuccess(true);
    
    setTimeout(() => {
      if (onSuccess) onSuccess(finalSubmissionData);
      setIsSubmitting(false);
    }, 1000);
  };

  // Steps matching your modular categories
  const steps = [
    { number: 1, title: "Patient Info", icon: User },
    { number: 2, title: "Test Selection", icon: Beaker },
    { number: 3, title: "Schedule", icon: Calendar },
    { number: 4, title: "Location / Setup", icon: MapPin }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative max-w-5xl w-full mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden animate-[fadeIn_0.3s_ease-out]">
        
        {/* Premium Header with Gradient */}
        <div className="relative bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 px-8 py-6">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Stethoscope className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">New Patient Registration</h2>
                  <p className="text-indigo-200 text-sm mt-1">{labName} (ID: {formData.lab_id})</p>
                </div>
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
          
          {/* Progress Steps */}
          <div className="flex gap-2 mt-6">
            {steps.map(step => (
              <button
                key={step.number}
                type="button"
                onClick={() => setActiveStep(step.number)}
                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                  activeStep === step.number 
                    ? 'bg-white text-indigo-700 shadow-lg' 
                    : activeStep > step.number 
                      ? 'bg-white/20 text-white' 
                      : 'bg-white/10 text-indigo-200'
                }`}
              >
                <step.icon className={`w-4 h-4 ${activeStep === step.number ? 'text-indigo-600' : ''}`} />
                <span className="text-xs font-medium hidden sm:inline">{step.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Success Banner */}
        {submitSuccess && (
          <div className="m-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 animate-[slideDown_0.3s_ease-out]">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="font-semibold text-emerald-800">Registration Successful!</p>
              <p className="text-sm text-emerald-600">The database operation records have completed setup logic.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          
          {/* STEP 1: Patient Information */}
          {activeStep === 1 && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className={`w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all ${
                        errors.name ? 'border-red-300 bg-red-50' : 'border-gray-200'
                      }`}
                      placeholder="Enter patient's full name"
                    />
                  </div>
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Mobile Number *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required
                      type="tel"
                      value={formData.mobile}
                      onChange={(e) => setFormData({...formData, mobile: e.target.value})}
                      className={`w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                        errors.mobile ? 'border-red-300 bg-red-50' : 'border-gray-200'
                      }`}
                      placeholder="10-digit mobile number"
                    />
                  </div>
                  {errors.mobile && <p className="text-xs text-red-500 mt-1">{errors.mobile}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">WhatsApp Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      placeholder="For immediate message routing"
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
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      placeholder="patient@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Age *</label>
                  <input
                    required
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({...formData, age: e.target.value})}
                    className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                      errors.age ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                    placeholder="Years"
                  />
                  {errors.age && <p className="text-xs text-red-500 mt-1">{errors.age}</p>}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Gender *</label>
                  <select
                    required
                    value={formData.gender}
                    onChange={(e) => setFormData({...formData, gender: e.target.value as any})}
                    className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white ${
                      errors.gender ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.gender && <p className="text-xs text-red-500 mt-1">{errors.gender}</p>}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Test Selection */}
          {activeStep === 2 && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {PREMIUM_TESTS.map((category) => {
                  const CategoryIcon = category.icon;
                  return (
                    <div key={category.category} className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-b border-gray-200">
                        <div className="flex items-center gap-2">
                          <CategoryIcon className="w-4 h-4 text-indigo-600" />
                          <h3 className="font-semibold text-gray-800">{category.category}</h3>
                        </div>
                      </div>
                      <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                        {category.tests.map(test => (
                          <label
                            key={test.code}
                            className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                              selectedTests.includes(test.code)
                                ? 'bg-indigo-50 border-indigo-200 border'
                                : 'hover:bg-gray-50 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <input
                                type="checkbox"
                                checked={selectedTests.includes(test.code)}
                                onChange={() => toggleTest(test.code)}
                                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                              />
                              <div>
                                <p className="font-medium text-gray-800 text-sm">{test.name}</p>
                                <p className="text-xs text-gray-500">{test.duration} turnaround</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-indigo-600">₹{test.price}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {errors.tests && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <p className="text-sm text-red-600">{errors.tests}</p>
                </div>
              )}

              {selectedTests.length > 0 && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-600">Selected Aggregates (`test` column payload)</p>
                      <p className="text-sm font-semibold text-indigo-900 mt-1 bg-white px-3 py-1 rounded-md border inline-block">
                        {formData.test}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-indigo-700">Total: ₹{estimatedTotal}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Schedule Information */}
          {activeStep === 3 && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Booking Type *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'Walk-in', icon: Activity, label: 'Walk-in' },
                      { value: 'Home Collection', icon: Home, label: 'Home' },
                      { value: 'Online', icon: Globe, label: 'Online' }
                    ].map(type => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFormData({...formData, booking_type: type.value as any})}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                          formData.booking_type === type.value
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        }`}
                      >
                        <type.icon className="w-5 h-5" />
                        <span className="text-xs font-medium">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Appointment Date *</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required
                      type="date"
                      value={formData.appointment_date}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setFormData({...formData, appointment_date: e.target.value})}
                      className={`w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                        errors.appointment_date ? 'border-red-300 bg-red-50' : 'border-gray-200'
                      }`}
                    />
                  </div>
                  {errors.appointment_date && <p className="text-xs text-red-500 mt-1">{errors.appointment_date}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Preferred Time *</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({...formData, time: e.target.value})}
                      className={`w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                        errors.time ? 'border-red-300 bg-red-50' : 'border-gray-200'
                      }`}
                    />
                  </div>
                  {errors.time && <p className="text-xs text-red-500 mt-1">{errors.time}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Workflow Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Prescription Document (Optional)</label>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 flex items-center gap-3 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-indigo-400 transition-all">
                      <Upload className="w-5 h-5 text-gray-400" />
                      <span className="text-sm text-gray-600">Upload prescription file to set prescription_url</span>
                      <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} className="hidden" />
                    </label>
                    {prescriptionPreview && (
                      <div className="relative">
                        <img src={prescriptionPreview} alt="Preview" className="w-12 h-12 object-cover rounded-lg border" />
                        <button
                          type="button"
                          onClick={() => { 
                            setPrescriptionPreview(null); 
                            setFormData(prev => ({ ...prev, prescription_file: null, prescription_url: '' })); 
                          }}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                  {errors.prescription && <p className="text-xs text-red-500 mt-1">{errors.prescription}</p>}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Location Details */}
          {activeStep === 4 && (
            <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Address Line</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <textarea
                      rows={2}
                      value={formData.address_line}
                      onChange={(e) => setFormData({...formData, address_line: e.target.value})}
                      className={`w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${
                        errors.address ? 'border-red-300 bg-red-50' : 'border-gray-200'
                      }`}
                      placeholder="House No, Street name, City location info"
                    />
                  </div>
                  {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Pincode</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={formData.pincode}
                      onChange={(e) => setFormData({...formData, pincode: e.target.value})}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      placeholder="6-digit pincode code"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Landmark</label>
                  <input
                    type="text"
                    value={formData.landmark}
                    onChange={(e) => setFormData({...formData, landmark: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    placeholder="Nearby reference milestone"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Remarks</label>
                  <textarea
                    rows={3}
                    value={formData.remarks}
                    onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    placeholder="Provide any case clinical records history or generic system notes here..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between gap-3 pt-6 mt-6 border-t border-gray-100">
            <div className="flex gap-3">
              {activeStep > 1 && (
                <button
                  type="button"
                  onClick={() => setActiveStep(prev => prev - 1)}
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-all"
                >
                  Back
                </button>
              )}
            </div>
            
            <div className="flex gap-3">
              {activeStep < 4 ? (
                <button
                  type="button"
                  onClick={() => setActiveStep(prev => prev + 1)}
                  className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2"
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <>
                  {onCancel && (
                    <button
                      type="button"
                      onClick={onCancel}
                      className="px-6 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-all"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing Database Entry...
                      </>
                    ) : (
                      <>
                        Register Patient
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
};

export default BookingRegistrationForm;
