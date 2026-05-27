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
  
  // Database Core Source-of-Truth States
  const [labId, setLabId] = useState<string | null>(null);
  const [labName, setLabName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [tests, setTests] = useState<LabTestItem[]>([]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [email, setEmail] = useState('');

  // Temporary Edit Form States (Used within modals)
  const [tempLabName, setTempLabName] = useState('');
  const [tempLogoUrl, setTempLogoUrl] = useState('');
  const [tempPhoneNumber, setTempPhoneNumber] = useState('');
  const [tempWhatsappNumber, setTempWhatsappNumber] = useState('');
  const [tempEmail, setTempEmail] = useState('');
  
  const [newTestName, setNewTestName] = useState('');
  const [newTestPrice, setNewTestPrice] = useState('');

  // Inline Editing States for Existing Tests
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
            .select('lab_name, logo_url, available_tests, phone_number, whatsapp_number, email')
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

  const openBrandModal = () => {
    setTempLabName(labName);
    setTempLogoUrl(logoUrl);
    setActiveModal('brand');
  };

  const openCatalogModal = () => {
    setActiveModal('catalog');
  };

  const openContactModal = () => {
    setTempPhoneNumber(phoneNumber);
    setTempWhatsappNumber(whatsappNumber);
    setTempEmail(email);
    setActiveModal('contact');
  };

  const closeModal = () => {
    setActiveModal('none');
    setNewTestName('');
    setNewTestPrice('');
    setEditingIndex(null);
  };

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labId) return;
    setSaving(true);
    try {
      await supabase
        .from('labs')
        .update({ lab_name: tempLabName, logo_url: tempLogoUrl })
        .eq('id', labId);
      
      setLabName(tempLabName);
      setLogoUrl(tempLogoUrl);
      showToast("Identity configuration saved!");
      onLabUpdated();
      closeModal();
    } catch (err) {
      console.error("Error updating profile settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labId) return;
    setSaving(true);
    try {
      await supabase
        .from('labs')
        .update({ 
          phone_number: tempPhoneNumber, 
          whatsapp_number: tempWhatsappNumber, 
          email: tempEmail 
        })
        .eq('id', labId);
      
      setPhoneNumber(tempPhoneNumber);
      setWhatsappNumber(tempWhatsappNumber);
      setEmail(tempEmail);
      showToast("Contact credentials synchronized!");
      onLabUpdated();
      closeModal();
    } catch (err) {
      console.error("Error updating contact infrastructure settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddTest = async () => {
    if (!newTestName.trim() || !newTestPrice.trim() || !labId) return;
    const updatedTests = [
      ...tests, 
      { name: newTestName.trim(), price: parseFloat(newTestPrice) || 0 }
    ];
    
    setSaving(true);
    try {
      await supabase
        .from('labs')
        .update({ available_tests: updatedTests })
        .eq('id', labId);
      
      setTests(updatedTests);
      setNewTestName('');
      setNewTestPrice('');
      showToast("Test added to inventory!");
    } catch (err) {
      console.error("Error sync catalog item:", err);
    } finally {
      setSaving(false);
    }
  };

  const startInlineEdit = (index: number, test: LabTestItem) => {
    setEditingIndex(index);
    setEditTestName(test.name);
    setEditTestPrice(test.price.toString());
  };

  const handleSaveInlineEdit = async (indexToUpdate: number) => {
    if (!editTestName.trim() || !editTestPrice.trim() || !labId) return;
    
    const updatedTests = tests.map((test, idx) => {
      if (idx === indexToUpdate) {
        return { name: editTestName.trim(), price: parseFloat(editTestPrice) || 0 };
      }
      return test;
    });

    setSaving(true);
    try {
      await supabase
        .from('labs')
        .update({ available_tests: updatedTests })
        .eq('id', labId);
      
      setTests(updatedTests);
      setEditingIndex(null);
      showToast("Catalog item updated!");
    } catch (err) {
      console.error("Error updating inline catalog item:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTest = async (indexToRemove: number) => {
    if (!labId) return;
    const updatedTests = tests.filter((_, idx) => idx !== indexToRemove);
    
    setSaving(true);
    try {
      await supabase
        .from('labs')
        .update({ available_tests: updatedTests })
        .eq('id', labId);
      
      setTests(updatedTests);
      if (editingIndex === indexToRemove) setEditingIndex(null);
      showToast("Test removed from catalog.");
    } catch (err) {
      console.error("Error dropping catalog item:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-xs font-medium text-slate-500 tracking-wide">Loading configurations...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-indigo-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Toast Alert */}
        {successMessage && (
          <div className="fixed bottom-6 right-6 bg-slate-950 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-slate-800 animate-in fade-in slide-in-from-bottom-4 z-50">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium">{successMessage}</span>
          </div>
        )}

        {/* Top Header Navigation Row */}
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
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">Lab Control Center</h1>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Configure system infrastructure credentials, identities, and public catalogs.</p>
            </div>
          </div>
          <div className="self-start sm:self-center text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 border border-emerald-200/60">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Secured System Active
          </div>
        </div>

        {/* Two-Column Overview Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Main Dashboard Display Cards */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Identity Card Profile */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{labName || 'No Name Set'}</h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-[280px] sm:max-w-md">
                    {logoUrl ? 'Custom Brand Logo Linked' : 'No custom branding path provided'}
                  </p>
                </div>
              </div>
              <button
                onClick={openBrandModal}
                className="w-full sm:w-auto px-4 py-2 text-xs border border-slate-200 hover:border-slate-300 rounded-xl font-medium transition flex items-center justify-center gap-2 hover:bg-slate-50 text-slate-700 shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit Identity
              </button>
            </div>

            {/* Contact Channels Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <h3 className="text-sm font-semibold text-slate-900">Communication & Notification Desks</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs text-slate-500">
                  <div className="flex items-center gap-2 truncate">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{phoneNumber || 'No phone set'}</span>
                  </div>
                  <div className="flex items-center gap-2 truncate">
                    <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.455L0 24zm6.59-4.846c1.642.975 3.251 1.489 4.814 1.491 5.487.002 9.947-4.461 9.95-9.95.001-2.659-1.03-5.159-2.905-7.037a9.83 9.83 0 0 0-7.042-2.922C5.934.734 1.473 5.199 1.47 10.69c-.001 1.673.447 3.307 1.299 4.757L1.825 21.79l6.596-1.732z"/>
                    </svg>
                    <span className="truncate">{whatsappNumber || 'No WhatsApp set'}</span>
                  </div>
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{email || 'No email set'}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={openContactModal}
                className="w-full sm:w-auto px-4 py-2 text-xs border border-slate-200 hover:border-slate-300 rounded-xl font-medium transition flex items-center justify-center gap-2 hover:bg-slate-50 text-slate-700 shadow-sm shrink-0"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit Contacts
              </button>
            </div>

            {/* Inventory Overview Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Assigned Catalog Inventory</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Currently exposing <span className="font-bold text-indigo-600">{tests.length}</span> active runs to front checkout interfaces.
                  </p>
                </div>
                <button
                  onClick={openCatalogModal}
                  className="px-4 py-2 text-xs bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-semibold transition flex items-center gap-2 shadow-sm"
                >
                  <ListPlus className="w-3.5 h-3.5" /> Manage Catalog
                </button>
              </div>
            </div>

          </div>

          {/* Right Column Realtime Live Preview Viewport */}
          <div className="space-y-6 lg:sticky lg:top-8">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Viewport Preview</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Real-time mapping parameters mirrored to public checkouts.</p>
              </div>
              
              <div className="border border-slate-200/80 rounded-xl bg-slate-50/50 p-4">
                <div className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Preview Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="truncate flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate">{labName || 'Untitled Clinic Endpoint'}</p>
                    <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                      Accepting Bookings
                    </p>
                  </div>
                </div>

                {/* Micro Meta Badges for Contacts in Preview */}
                {(phoneNumber || email) && (
                  <div className="mt-2 flex flex-wrap gap-1.5 px-1 text-[9px] text-slate-400 font-mono">
                    {phoneNumber && <span className="truncate max-w-[100px]">📞 {phoneNumber}</span>}
                    {email && <span className="truncate max-w-[120px]">✉️ {email}</span>}
                  </div>
                )}
                
                <div className="mt-4 bg-white rounded-xl border border-slate-200/60 p-4 space-y-3">
                  <div>
                    <div className="h-1.5 w-12 bg-slate-200 rounded mb-1.5"></div>
                    <div className="h-8 w-full bg-slate-50 border border-slate-200/60 rounded-lg flex items-center px-3 justify-between text-[11px] text-slate-400 font-medium">
                      <span>Select target diagnostic run...</span>
                      <span className="text-[9px] text-slate-400">▼</span>
                    </div>
                  </div>
                  <div className="h-8 w-full bg-indigo-600 rounded-lg flex items-center justify-center text-[11px] font-semibold text-white shadow-sm">
                    Proceed to Booking
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ================= MODAL OVERLAYS BACKDROP COMPONENTS ================= */}
      {activeModal !== 'none' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          
          {/* Identity Update Modal Configuration Card */}
          {activeModal === 'brand' && (
            <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Update Profile Context</h3>
                  <p className="text-[11px] text-slate-500">Modify legal name declarations and graphic assets.</p>
                </div>
                <button onClick={closeModal} className="p-1 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSaveBrand}>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">Display Name</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={tempLabName}
                        onChange={(e) => setTempLabName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 transition text-slate-900"
                        placeholder="e.g., City Diagnostic Center"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">Brand Graphic Asset URL</label>
                    <div className="relative">
                      <Upload className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="url"
                        value={tempLogoUrl}
                        onChange={(e) => setTempLogoUrl(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 transition font-mono text-xs text-slate-900"
                        placeholder="https://example.com/logo.png"
                      />
                    </div>
                  </div>
                </div>
                <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-xs border border-slate-200 rounded-xl font-medium hover:bg-white text-slate-600 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-xs bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                    Save Properties
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Contact Infrastructure Update Modal Configuration Card */}
          {activeModal === 'contact' && (
            <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Update Contact Gateways</h3>
                  <p className="text-[11px] text-slate-500">Configure phone lines, message targets, and email routes.</p>
                </div>
                <button onClick={closeModal} className="p-1 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSaveContact}>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="tel"
                        value={tempPhoneNumber}
                        onChange={(e) => setTempPhoneNumber(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 transition text-slate-900"
                        placeholder="e.g., +91 98765 43210"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">WhatsApp Business Number</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.455L0 24zm6.59-4.846c1.642.975 3.251 1.489 4.814 1.491 5.487.002 9.947-4.461 9.95-9.95.001-2.659-1.03-5.159-2.905-7.037a9.83 9.83 0 0 0-7.042-2.922C5.934.734 1.473 5.199 1.47 10.69c-.001 1.673.447 3.307 1.299 4.757L1.825 21.79l6.596-1.732z"/>
                        </svg>
                      </span>
                      <input
                        type="tel"
                        value={tempWhatsappNumber}
                        onChange={(e) => setTempWhatsappNumber(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 transition text-slate-900"
                        placeholder="e.g., +91 98765 43210"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Administrative Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        value={tempEmail}
                        onChange={(e) => setTempEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 transition text-slate-900"
                        placeholder="e.g., desk@citylabs.com"
                      />
                    </div>
                  </div>
                </div>
                <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-xs border border-slate-200 rounded-xl font-medium hover:bg-white text-slate-600 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-xs bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                    Save Contacts
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Test Catalog Management Full Sheet Overlay Modal Context */}
          {activeModal === 'catalog' && (
            <div className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Manage Diagnostics Catalog</h3>
                  <p className="text-[11px] text-slate-500">Inject, update, or terminate test profiles real-time into database layers.</p>
                </div>
                <button onClick={closeModal} className="p-1 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                {/* Add New Test Block */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60 flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <ListPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={newTestName}
                      onChange={(e) => setNewTestName(e.target.value)}
                      placeholder="e.g., Liver Function Test (LFT)"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 bg-white rounded-lg focus:outline-none focus:border-indigo-500 text-slate-900"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="relative w-24">
                      <Coins className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="number"
                        value={newTestPrice}
                        onChange={(e) => setNewTestPrice(e.target.value)}
                        placeholder="Rate"
                        className="w-full pl-8 pr-2 py-2 text-xs border border-slate-200 bg-white rounded-lg focus:outline-none focus:border-indigo-500 text-slate-900 font-mono"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleAddTest}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition flex items-center gap-1 disabled:opacity-50 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </div>

                {/* Modals Scrollable Dynamic Entries Listing Block Viewport */}
                <div className="border border-slate-200/60 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white max-h-60 overflow-y-auto">
                  {tests.length === 0 ? (
                    <div className="text-center py-8">
                      <Info className="w-4 h-4 text-slate-400 mx-auto mb-1.5" />
                      <p className="text-xs text-slate-400 italic">No assigned entries compiled in catalog roster yet.</p>
                    </div>
                  ) : (
                    tests.map((test, index) => (
                      <div key={index} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50/30 transition min-h-[50px]">
                        
                        {editingIndex === index ? (
                          /* === INLINE EDIT MODE ACTIVE === */
                          <div className="flex items-center gap-2 w-full animate-in fade-in duration-100">
                            <input 
                              type="text" 
                              value={editTestName}
                              onChange={(e) => setEditTestName(e.target.value)}
                              className="flex-1 px-2.5 py-1 text-xs border border-indigo-400 rounded-lg focus:outline-none bg-white text-slate-900 font-medium"
                            />
                            <div className="relative w-24">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-medium">₹</span>
                              <input 
                                type="number" 
                                value={editTestPrice}
                                onChange={(e) => setEditTestPrice(e.target.value)}
                                className="w-full pl-5 pr-2 py-1 text-xs border border-indigo-400 rounded-lg focus:outline-none bg-white text-slate-900 font-mono font-bold"
                              />
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleSaveInlineEdit(index)}
                                title="Save changes"
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded border border-emerald-200 transition"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingIndex(null)}
                                title="Cancel"
                                className="p-1 text-slate-400 hover:bg-slate-100 rounded border border-slate-200 transition"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* === READ ONLY VIEW MODE === */
                          <>
                            <span className="text-xs font-medium text-slate-700">{test.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/40">
                                ₹{test.price}
                              </span>
                              <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition">
                                <button
                                  type="button"
                                  onClick={() => startInlineEdit(index, test)}
                                  title="Edit test parameters"
                                  className="text-slate-400 hover:text-indigo-600 p-1 hover:bg-indigo-50 rounded transition"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => handleRemoveTest(index)}
                                  title="Remove from inventory"
                                  className="text-slate-400 hover:text-rose-600 p-1 hover:bg-rose-50 rounded transition disabled:opacity-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </>
                        )}

                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2 text-xs bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition"
                >
                  Done
                </button>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
