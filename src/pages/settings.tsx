import { useState, useEffect } from 'react';
import { 
  Building2, ArrowLeft, Save, Upload, Plus, Trash2, 
  Settings as SettingsIcon, ShieldCheck, RefreshCw, CheckCircle2 
} from 'lucide-react';
import { supabase, Lab } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface SettingsProps {
  onBack: () => void;
  onLabUpdated: () => void;
}

interface LabTestItem {
  name: string;
  price: number;
}

export default function Settings({ onBack, onLabUpdated }: SettingsProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Form profile states
  const [labId, setLabId] = useState<string | null>(null);
  const [labName, setLabName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  
  // Tests management array
  const [tests, setTests] = useState<LabTestItem[]>([]);
  const [newTestName, setNewTestName] = useState('');
  const [newTestPrice, setNewTestPrice] = useState('');

  useEffect(() => {
    async function loadLabSettings() {
      if (!user?.id) return;
      setLoading(true);
      try {
        const { data: adminLink } = await supabase
          .from('lab_admins')
          .select('lab_id')
          .eq('user_id', user.id)
          .single();

        if (adminLink?.lab_id) {
          setLabId(adminLink.lab_id);
          
          const { data: labData } = await supabase
            .from('labs')
            .select('*')
            .eq('id', adminLink.lab_id)
            .maybeSingle();

          if (labData) {
            setLabName(labData.lab_name || '');
            setLogoUrl(labData.logo_url || '');
            // Safeguard parsing tests if saved as JSON or separate schema
            setTests(Array.isArray(labData.tests) ? labData.tests : []);
          }
        }
      } catch (err) {
        console.error("Error loading profile configurations:", err);
      } finally {
        setLoading(false);
      }
    }
    loadLabSettings();
  }, [user?.id]);

  const showToast = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labId) return;
    setSaving(true);
    try {
      await supabase
        .from('labs')
        .update({
          lab_name: labName,
          logo_url: logoUrl,
          tests: tests // Assumes dynamic jsonb column implementation
        })
        .eq('id', labId);
      
      showToast("Settings updated successfully!");
      onLabUpdated();
    } catch (err) {
      console.error("Error updates profile settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddTest = () => {
    if (!newTestName.trim() || !newTestPrice.trim()) return;
    const updatedTests = [
      ...tests, 
      { name: newTestName.trim(), price: parseFloat(newTestPrice) || 0 }
    ];
    setTests(updatedTests);
    setNewTestName('');
    setNewTestPrice('');
  };

  const handleRemoveTest = (indexToRemove: number) => {
    setTests(tests.filter((_, idx) => idx !== indexToRemove));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-50 via-slate-100 to-gray-200 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-50 via-slate-100 to-gray-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        
        {/* Banner Alert Notification */}
        {successMessage && (
          <div className="fixed top-6 right-6 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-fade-in z-50">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-semibold">{successMessage}</span>
          </div>
        )}

        {/* Back and Title Bar Nav */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.07)] px-6 py-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-slate-50 rounded-xl border border-gray-200 transition shadow-sm text-gray-600"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                <SettingsIcon className="w-5 h-5 text-blue-600" /> Control Console
              </h1>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Configure Lab Modules & Properties</p>
            </div>
          </div>
          <div className="text-xs bg-slate-100 px-3 py-1.5 rounded-lg text-slate-600 font-mono flex items-center gap-1.5 border border-slate-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> System Active
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Identity panel details form container */}
          <div className="md:col-span-2 space-y-6">
            <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl border border-gray-200 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.1)] p-6 space-y-5">
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider border-b border-gray-100 pb-3">Lab Profile Identity</h2>
              
              <div>
                <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">Lab Name Display</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={labName}
                    onChange={(e) => setLabName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter Legal Clinic Title Name..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">Logo URL Endpoint Address</label>
                <div className="relative">
                  <Upload className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                    placeholder="https://example.com/logo.png"
                  />
                </div>
              </div>

              {/* Dynamic Services Array Editor */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">Offered Lab Diagnostics & Assays Pricing</label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newTestName}
                    onChange={(e) => setNewTestName(e.target.value)}
                    placeholder="Test Name (e.g., CBC, Lipid Panel)"
                    className="flex-1 px-3 py-2 text-xs border border-gray-200 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    value={newTestPrice}
                    onChange={(e) => setNewTestPrice(e.target.value)}
                    placeholder="Price (₹)"
                    className="w-24 px-3 py-2 text-xs border border-gray-200 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddTest}
                    className="px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-sm flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Listing of existing operational records dynamically compiled */}
                <div className="border border-gray-100 rounded-xl max-h-48 overflow-y-auto divide-y divide-gray-50 bg-slate-50/50">
                  {tests.length === 0 ? (
                    <p className="text-center text-xs text-gray-400 py-6 italic">No localized laboratory tests assigned.</p>
                  ) : (
                    tests.map((test, index) => (
                      <div key={index} className="px-4 py-2.5 flex items-center justify-between text-xs bg-white">
                        <span className="font-semibold text-gray-800">{test.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-gray-600 bg-slate-100 px-2 py-0.5 rounded">₹{test.price}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTest(index)}
                            className="text-gray-400 hover:text-red-500 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-600/20 hover:bg-blue-700 transition disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving System Changes...' : 'Save Configuration Options'}
                </button>
              </div>
            </form>
          </div>

          {/* Realtime Live preview workspace layout column block tracker wrapper */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.1)] p-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Patient Form Live Preview</h3>
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-inner bg-slate-50 p-4">
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full border border-gray-200 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Preview Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-gray-800 truncate">{labName || 'Partner Lab Loading...'}</p>
                    <p className="text-[9px] text-emerald-600 font-medium">● Diagnostics Portal Active</p>
                  </div>
                </div>
                
                <div className="mt-3 bg-white rounded-lg border border-gray-100 p-2.5">
                  <div className="h-2 w-16 bg-slate-200 rounded mb-2"></div>
                  <div className="h-7 w-full bg-slate-50 border rounded-md flex items-center px-2 justify-between text-[10px] text-gray-400">
                    <span>Select diagnostics test target run...</span>
                    <span>▼</span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mt-3 text-center italic">This preview dynamically tracks alterations to the branding configuration live.</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
