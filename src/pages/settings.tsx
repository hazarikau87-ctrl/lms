import { useState, useEffect } from 'react';
import { 
  Building2, ArrowLeft, Save, Upload, Plus, Trash2, 
  Settings as SettingsIcon, ShieldCheck, RefreshCw, CheckCircle2,
  ListPlus, Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
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
          tests: tests
        })
        .eq('id', labId);
      
      showToast("Settings saved successfully!");
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-xs font-medium text-slate-500 tracking-wide">Loading configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-indigo-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Banner Alert Notification */}
        {successMessage && (
          <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-300 z-50">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium">{successMessage}</span>
          </div>
        )}

        {/* Header Action Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-8 mb-8 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2.5 hover:bg-white rounded-xl border border-slate-200 text-slate-600 transition shadow-sm hover:shadow-md hover:border-slate-300 group"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-indigo-600" />
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">Lab Settings</h1>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Manage your clinic identity, branding configurations, and test offering catalog.</p>
            </div>
          </div>
          <div className="self-start sm:self-center text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 border border-emerald-200/60">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Core Engine Operational
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Main Controls Configuration Form */}
          <div className="lg:col-span-2 space-y-8">
            <form onSubmit={handleSaveProfile} className="space-y-8">
              
              {/* Profile Card */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Lab Identity</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Update public-facing info used on checkout panels and invoices.</p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">Display Name</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={labName}
                        onChange={(e) => setLabName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                        placeholder="e.g., Apex Diagnostic Labs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">Branding Brand Logo URL</label>
                    <div className="relative">
                      <Upload className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="url"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition font-mono text-xs"
                        placeholder="https://yourdomain.com/assets/logo.png"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Catalog Section */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Test Inventory & Rates</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Configure available panel runs mapping to patient checkouts.</p>
                  </div>
                  <span className="text-[11px] bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-1 rounded-full border border-indigo-100">
                    {tests.length} Active {tests.length === 1 ? 'Test' : 'Tests'}
                  </span>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60 flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <ListPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={newTestName}
                      onChange={(e) => setNewTestName(e.target.value)}
                      placeholder="Test name (e.g., Complete Blood Count)"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 bg-white rounded-lg focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="relative w-28">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">₹</span>
                      <input
                        type="number"
                        value={newTestPrice}
                        onChange={(e) => setNewTestPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-6 pr-3 py-2 text-xs border border-slate-200 bg-white rounded-lg focus:outline-none focus:border-indigo-500 transition font-mono"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddTest}
                      className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition shadow-sm flex items-center justify-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </div>

                {/* Listing Grid Layout */}
                <div className="border border-slate-200/60 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white max-h-64 overflow-y-auto">
                  {tests.length === 0 ? (
                    <div className="text-center py-8">
                      <Info className="w-4 h-4 text-slate-400 mx-auto mb-1.5" />
                      <p className="text-xs text-slate-400 italic">No assigned entries compiled in catalog roster yet.</p>
                    </div>
                  ) : (
                    tests.map((test, index) => (
                      <div key={index} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50/60 transition group">
                        <span className="text-xs font-medium text-slate-700">{test.name}</span>
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200/40">₹{test.price}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTest(index)}
                            className="text-slate-400 hover:text-rose-600 p-1 hover:bg-rose-50 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Bottom Sticky Action Footer Row Container */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium text-xs rounded-xl shadow-md hover:bg-indigo-700 transition disabled:opacity-50 font-semibold"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Updating Configurations...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      Save Configurations
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Realtime Live Preview Box Frame */}
          <div className="space-y-6 lg:sticky lg:top-8">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Form Context</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">How your lab appears to incoming patients online.</p>
              </div>
              
              <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-slate-50/50 p-4">
                {/* Client Side Form Component Simulation Structure Header Block */}
                <div className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Preview Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="truncate flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate">{labName || 'Untitled Partner Lab'}</p>
                    <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                      Accepting Bookings
                    </p>
                  </div>
                </div>
                
                {/* Simulated Interactive Core Fields Form Selection Content Context Box */}
                <div className="mt-4 bg-white rounded-xl border border-slate-200/60 p-4 space-y-3">
                  <div>
                    <div className="h-1.5 w-12 bg-slate-200 rounded mb-1.5"></div>
                    <div className="h-8 w-full bg-slate-50 border border-slate-200/60 rounded-lg flex items-center px-3 justify-between text-[11px] text-slate-400 font-medium">
                      <span>Select requested analysis panel...</span>
                      <span className="text-[9px] text-slate-400">▼</span>
                    </div>
                  </div>
                  <div className="h-8 w-full bg-indigo-600 rounded-lg flex items-center justify-center text-[11px] font-semibold text-white shadow-sm shadow-indigo-600/10">
                    Proceed to Scheduling
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 text-center italic">Form previews rendering configurations engine alterations natively.</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
