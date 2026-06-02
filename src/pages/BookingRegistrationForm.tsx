import React, { useState } from 'react';

// Define the structure based on your database columns
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
  booking_type: 'Walk-in' | 'Home Collection' | 'Online';
  address_line: string;
  pincode: string;
  landmark: string;
}

interface BookingRegistrationFormProps {
  onSuccess?: (data: AppointmentData) => void;
  onCancel?: () => void;
  currentLabId?: string; // Can be passed down from the main dashboard context
}

export const BookingRegistrationForm: React.FC<BookingRegistrationFormProps> = ({ 
  onSuccess, 
  onCancel,
  currentLabId = "LAB-001" 
}) => {
  // Initialize state with your exact column fields
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simulating auto-generating background metadata before sending to API
    const finalSubmissionData: AppointmentData = {
      ...formData,
      id: `APT-${Math.floor(100000 + Math.random() * 900000)}`,
      booking_id: `BK-${Date.now().toString().slice(-6)}`,
      created_at: new Date().toISOString()
    };

    console.log("Submitting Appointment Payload: ", finalSubmissionData);
    
    if (onSuccess) {
      onSuccess(finalSubmissionData);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-md border border-gray-100">
      <div className="border-b pb-4 mb-6">
        <h2 className="text-xl font-bold text-gray-800">New Booking Registration</h2>
        <p className="text-sm text-gray-500">Register patient appointments and lab tests.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* SECTION 1: Patient Information */}
        <div>
          <h3 className="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-3">1. Patient Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="John Doe" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age *</label>
              <input required type="number" name="age" value={formData.age} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="e.g. 28" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
              <select required name="gender" value={formData.gender} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white">
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number *</label>
              <input required type="tel" name="mobile" value={formData.mobile} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="10-digit mobile" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
              <input type="tel" name="whatsapp" value={formData.whatsapp} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="WhatsApp number" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="john@example.com" />
            </div>
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* SECTION 2: Appointment & Test Information */}
        <div>
          <h3 className="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-3">2. Test & Schedule</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Required Test(s) *</label>
              <input required type="text" name="test" value={formData.test} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="e.g. Complete Blood Count (CBC), Fasting Blood Sugar" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Booking Type</label>
              <select name="booking_type" value={formData.booking_type} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white">
                <option value="Walk-in">Walk-in</option>
                <option value="Home Collection">Home Collection</option>
                <option value="Online">Online</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Appointment Date *</label>
              <input required type="date" name="appointment_date" value={formData.appointment_date} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Time *</label>
              <input required type="time" name="time" value={formData.time} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white">
                <option value="Pending">Pending</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Prescription URL / Doc Link</label>
              <input type="url" name="prescription_url" value={formData.prescription_url} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="https://storage.cloud/prescriptions/file.pdf" />
            </div>
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* SECTION 3: Location Details (Crucial for Home Collection) */}
        <div>
          <h3 className="text-sm font-semibold text-indigo-600 uppercase tracking-wider mb-3">3. Address & Location Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address Line</label>
              <input type="text" name="address_line" value={formData.address_line} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="House/Flat No, Street Name, Area" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
              <input type="text" name="pincode" value={formData.pincode} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="6-digit ZIP/Pincode" />
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Landmark</label>
              <input type="text" name="landmark" value={formData.landmark} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="e.g. Near City Hospital Metro Station" />
            </div>
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* SECTION 4: Additional Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Remarks / Notes</label>
          <textarea rows={3} name="remarks" value={formData.remarks} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="Add any special instructions or clinical history notes here..." />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          {onCancel && (
            <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition">
              Cancel
            </button>
          )}
          <button type="submit" className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 shadow-sm transition">
            Register Appointment
          </button>
        </div>

      </form>
    </div>
  );
};
