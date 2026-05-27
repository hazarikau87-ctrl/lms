import { useState, useEffect } from 'react';
import { 
  Building2, ArrowLeft, Upload, Plus, Trash2, 
  Settings as SettingsIcon, ShieldCheck, RefreshCw, CheckCircle2,
  ListPlus, Info, Edit3, X, Coins, Check, Phone, Mail
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

type ModalType = 'none' | 'brand' | 'catalog' | 'contact';

export default function Settings({ onBack, onLabUpdated }: SettingsProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeModal, setActiveModal] = useState<ModalType>('none');
  
  // Database Core State
  const [labId, setLabId] = useState<string | null>(null);
  const [labName, setLabName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [tests, setTests] = useState<LabTestItem[]>([]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [email, setEmail] = useState('');

  // Temporary Modal Form States
  const [tempLabName, setTempLabName] = useState('');
  const [tempLogoUrl, setTempLogoUrl] = useState('');
  const [tempPhoneNumber, setTempPhoneNumber] = useState('');
  const [tempWhatsappNumber, setTempWhatsappNumber] = useState('');
  const [tempEmail, setTempEmail] = useState('');
  
  const [newTestName, setNewTestName] = useState('');
  const [newTestPrice, setNewTestPrice] = useState('');

  // Inline Editing States
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editTestName, setEditTestName] = useState('');
  const [editTestPrice, setEditTestPrice] = useState('');

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
            setPhoneNumber(labData.phone_number || '');
            setWhatsappNumber(labData.whatsapp_number || '');
            setEmail(labData.email || '');
            setTests(Array.isArray(labData.available_tests) ? labData.available_tests : []);
          }
        }
      } catch (err) {
        console.error("Error loading settings:", err);
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

  const closeModal = () => {
    setActiveModal('none');
    setEditingIndex(null);
  };

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labId) return;
    setSaving(true);
    try {
      await supabase.from('labs').update({ lab_name: tempLabName, logo_url: tempLogoUrl }).eq('id', labId);
      setLabName(tempLabName);
      setLogoUrl(tempLogoUrl);
      showToast("Identity updated!");
      onLabUpdated();
      closeModal();
    } finally { setSaving(false); }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labId) return;
    setSaving(true);
    try {
      await supabase.from('labs').update({ 
        phone_number: tempPhoneNumber, whatsapp_number: tempWhatsappNumber, email: tempEmail 
      }).eq('id', labId);
      setPhoneNumber(tempPhoneNumber);
      setWhatsappNumber(tempWhatsappNumber);
      setEmail(tempEmail);
      showToast("Contacts updated!");
      onLabUpdated();
      closeModal();
    } finally { setSaving(false); }
  };

  const handleUpdateTests = async (updatedTests: LabTestItem[]) => {
    if (!labId) return;
    setSaving(true);
    try {
      await supabase.from('labs').update({ available_tests: updatedTests }).eq('id', labId);
      setTests(updatedTests);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    } finally { setSaving(false); }
  };

  const handleAddTest = async () => {
    if (!newTestName.trim() || !newTestPrice) return;
    const updated = [...tests, { name: newTestName.trim(), price: Number(newTestPrice) }];
    if (await handleUpdateTests(updated)) {
      setNewTestName('');
      setNewTestPrice('');
      showToast("Test added!");
    }
  };

  const handleRemoveTest = async (index: number) => {
    const updated = tests.filter((_, i) => i !== index);
    if (await handleUpdateTests(updated)) showToast("Removed!");
  };

  const handleSaveInlineEdit = async (index: number) => {
    const updated = tests.map((t, i) => i === index ? { name: editTestName, price: Number(editTestPrice) } : t);
    if (await handleUpdateTests(updated)) {
      setEditingIndex(null);
      showToast("Updated!");
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <div className="max-w-5xl mx-auto px-4 py-10">
        
        {successMessage && (
          <div className="fixed bottom-6 right-6 bg-slate-950 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 z-50 animate-in fade-in slide-in-from-bottom-4">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium">{successMessage}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-8 mb-8 border-b">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2.5 hover:bg-white rounded-xl border transition shadow-sm"><ArrowLeft className="w-4 h-4" /></button>
            <div>
              <div className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-indigo-600" />
                <h1 className="text-xl font-semibold">Lab Control Center</h1>
              </div>
            </div>
          </div>
          <div className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200">Secured System Active</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border p-6 flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl border flex items-center justify-center overflow-hidden">
                  {logoUrl ? <img src={logoUrl} className="w-full h-full object-cover" /> : <Building2 className="w-6 h-6 text-slate-400" />}
                </div>
                <div>
                  <h2 className="text-sm font-semibold">{labName || 'No Name Set'}</h2>
                </div>
              </div>
              <button onClick={() => { setTempLabName(labName); setTempLogoUrl(logoUrl); setActiveModal('brand'); }} className="px-4 py-2 text-xs border rounded-xl hover:bg-slate-50 flex items-center gap-2"><Edit3 className="w-3.5 h-3.5" /> Edit</button>
            </div>

            <div className="bg-white rounded-2xl border p-6 flex justify-between items-center shadow-sm">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Communication Channels</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-500">
                  <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{phoneNumber || 'N/A'}</div>
                  <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" />{email || 'N/A'}</div>
                </div>
              </div>
              <button onClick={() => { setTempPhoneNumber(phoneNumber); setTempWhatsappNumber(whatsappNumber); setTempEmail(email); setActiveModal('contact'); }} className="px-4 py-2 text-xs border rounded-xl hover:bg-slate-50 flex items-center gap-2"><Edit3 className="w-3.5 h-3.5" /> Edit</button>
            </div>

            <div className="bg-white rounded-2xl border p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Assigned Catalog Inventory</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {tests.length} active tests available.
                  </p>
                </div>
                <button onClick={() => setActiveModal('catalog')} className="px-4 py-2 text-xs bg-slate-900 text-white rounded-xl flex items-center gap-2 shadow-sm"><ListPlus className="w-3.5 h-3.5" /> Manage</button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-indigo-600 rounded-2xl p-6 shadow-lg border border-indigo-500 text-white">
              <h3 className="font-semibold text-sm">Direct Intake</h3>
              <p className="text-indigo-100 text-[11px] mb-4">Register walk-in patients instantly.</p>
              <button onClick={() => alert("Module coming soon")} className="w-full bg-white text-indigo-600 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-inner"><Plus className="w-4 h-4" /> New Booking</button>
            </div>

            <div className="bg-white rounded-2xl border p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2"><Coins className="w-3.5 h-3.5" /> Insights</h3>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Avg Price</p>
                <p className="text-xl font-bold text-slate-900">₹{tests.length > 0 ? (tests.reduce((acc, curr) => acc + curr.price, 0) / tests.length).toFixed(0) : '0'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Logic */}
        {activeModal !== 'none' && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            {activeModal === 'brand' && (
               <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold">Update Identity</h3>
                  <X className="w-4 h-4 cursor-pointer" onClick={closeModal} />
                </div>
                <form onSubmit={handleSaveBrand} className="space-y-4">
                  <input value={tempLabName} onChange={(e) => setTempLabName(e.target.value)} className="w-full p-2.5 border rounded-xl text-sm" placeholder="Lab Name" />
                  <input value={tempLogoUrl} onChange={(e) => setTempLogoUrl(e.target.value)} className="w-full p-2.5 border rounded-xl text-sm font-mono" placeholder="Logo URL" />
                  <button type="submit" disabled={saving} className="w-full bg-indigo-600 text-white py-2 rounded-xl text-xs font-bold">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </form>
               </div>
            )}
            
            {activeModal === 'catalog' && (
              <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl">
                <div className="flex justify-between mb-4"><h3 className="text-sm font-semibold">Manage Catalog</h3><button onClick={closeModal}><X className="w-4 h-4"/></button></div>
                <div className="flex gap-2 mb-4">
                  <input value={newTestName} onChange={(e) => setNewTestName(e.target.value)} placeholder="Test Name" className="flex-1 p-2 border rounded-lg text-xs" />
                  <input value={newTestPrice} onChange={(e) => setNewTestPrice(e.target.value)} placeholder="₹" className="w-20 p-2 border rounded-lg text-xs" type="number" />
                  <button onClick={handleAddTest} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold">Add</button>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {tests.map((test, index) => (
                    <div key={index} className="p-3 bg-slate-50 rounded-xl flex justify-between items-center text-xs group">
                      {editingIndex === index ? (
                        <div className="flex gap-2 w-full">
                          <input value={editTestName} onChange={(e) => setEditTestName(e.target.value)} className="flex-1 p-1 border rounded" />
                          <input value={editTestPrice} onChange={(e) => setEditTestPrice(e.target.value)} className="w-16 p-1 border rounded" type="number" />
                          <Check className="w-4 h-4 text-emerald-600 cursor-pointer" onClick={() => handleSaveInlineEdit(index)} />
                        </div>
                      ) : (
                        <>
                          <span className="font-medium">{test.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-600">₹{test.price}</span>
                            <Edit3 className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-indigo-600" onClick={() => { setEditingIndex(index); setEditTestName(test.name); setEditTestPrice(test.price.toString()); }} />
                            <Trash2 className="w-3.5 h-3.5 text-rose-400 cursor-pointer hover:text-rose-600" onClick={() => handleRemoveTest(index)} />
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeModal === 'contact' && (
               <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold">Update Contacts</h3>
                  <X className="w-4 h-4 cursor-pointer" onClick={closeModal} />
                </div>
                <form onSubmit={handleSaveContact} className="space-y-4">
                  <input value={tempPhoneNumber} onChange={(e) => setTempPhoneNumber(e.target.value)} className="w-full p-2.5 border rounded-xl text-sm" placeholder="Phone Number" />
                  <input value={tempEmail} onChange={(e) => setTempEmail(e.target.value)} className="w-full p-2.5 border rounded-xl text-sm" placeholder="Email Address" />
                  <button type="submit" disabled={saving} className="w-full bg-indigo-600 text-white py-2 rounded-xl text-xs font-bold">
                    {saving ? 'Syncing...' : 'Update Contacts'}
                  </button>
                </form>
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
