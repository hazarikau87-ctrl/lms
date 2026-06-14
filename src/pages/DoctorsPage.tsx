import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase'; // Adjust path to your Supabase client

interface Doctor {
  id: string;
  lab_id: string;
  name: string;
  phone: string | null;
  specialty: string | null;
  commission_pct: number;
  is_active: boolean;
  created_at: string;
}

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Dynamic Lab Context State
  const [labId, setLabId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [commissionPct, setCommissionPct] = useState(10); // Default 10%

  // 1. Fetch the logged-in user's admin profile to map their lab context automatically
  useEffect(() => {
    async function getLabContext() {
      try {
        setAuthLoading(true);
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError) throw authError;

        if (!user) {
          setAuthLoading(false);
          return;
        }

        // ⭐ AUTOMATIC JUNCTION LOOKUP: Query 'lab_admins' using user_id to resolve lab_id
        const { data: adminData, error: adminError } = await supabase
          .from('lab_admins')
          .select('lab_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (adminError) throw adminError;

        if (adminData?.lab_id) {
          setLabId(adminData.lab_id);
        } else {
          console.error("This user account is not linked to any lab inside lab_admins.");
        }
      } catch (err) {
        console.error("Error fetching user session or lab context:", err);
      } finally {
        setAuthLoading(false);
      }
    }

    getLabContext();
  }, []);

  // 2. Fetch doctors automatically as soon as the labId state has successfully been resolved
  useEffect(() => {
    if (labId) {
      fetchDoctors(labId);
    }
  }, [labId]);

  async function fetchDoctors(activeLabId: string) {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .eq('lab_id', activeLabId) // Secure isolation: only fetch this specific lab's doctors
        .order('name', { ascending: true });

      if (error) throw error;
      setDoctors(data || []);
    } catch (err) {
      console.error('Error fetching doctors:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateDoctor(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !labId) return;

    try {
      const { error } = await supabase
        .from('doctors')
        .insert([{ 
          lab_id: labId, // Links the new doctor directly to this lab workspace
          name: name.trim(), 
          phone: phone.trim() || null,
          specialty: specialty.trim() || null, 
          commission_pct: commissionPct,
          is_active: true 
        }]);

      if (error) throw error;

      // Reset form & refresh list
      setName('');
      setPhone('');
      setSpecialty('');
      setCommissionPct(10);
      setIsModalOpen(false);
      fetchDoctors(labId);
    } catch (err) {
      console.error('Error adding doctor:', err);
    }
  }

  async function toggleDoctorStatus(id: string, currentStatus: boolean) {
    if (!labId) return;
    try {
      const { error } = await supabase
        .from('doctors')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      fetchDoctors(labId);
    } catch (err) {
      console.error('Error updating doctor status:', err);
    }
  }

  if (authLoading) {
    return <div className="text-center py-20 text-gray-500 font-medium">Verifying session...</div>;
  }

  if (!labId) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center space-y-4">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-5 rounded-xl shadow-sm">
          <p className="font-bold text-lg">Laboratory Link Required</p>
          <p className="text-sm mt-1 text-amber-700">
            We couldn't assign your administrator account to an active laboratory profile workspace. 
            Please verify configuration settings inside your 'lab_admins' table mappings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Doctor Directory</h1>
          <p className="text-sm text-gray-500 mt-1">Manage referring doctors and their commission structures.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors shadow-sm"
        >
          Add New Doctor
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading directory...</div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm text-gray-500">
            <thead className="bg-gray-50 text-xs text-gray-700 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 font-semibold">Name</th>
                <th className="px-6 py-3 font-semibold">Phone</th>
                <th className="px-6 py-3 font-semibold">Specialty</th>
                <th className="px-6 py-3 font-semibold">Commission Rate</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {doctors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-400">
                    No doctors registered yet for this laboratory.
                  </td>
                </tr>
              ) : (
                doctors.map((doctor) => (
                  <tr key={doctor.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{doctor.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{doctor.phone || '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{doctor.specialty || 'General'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{doctor.commission_pct}%</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        doctor.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {doctor.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => toggleDoctorStatus(doctor.id, doctor.is_active)}
                        className={`text-xs font-semibold ${
                          doctor.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'
                        }`}
                      >
                        {doctor.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Backdrop */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl border max-w-md w-full overflow-hidden transform transition-all">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Register New Doctor</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-semibold"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleCreateDoctor} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Dr. Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Specialty</label>
                <input
                  type="text"
                  placeholder="Cardiology, Pediatrics, etc."
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Commission Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  value={commissionPct}
                  onChange={(e) => setCommissionPct(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="pt-4 flex justify-end space-x-2 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium shadow-sm"
                >
                  Save Doctor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}