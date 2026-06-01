import React, { useState } from 'react';
import { Settings, X, Sliders, User, Shield, Bell, HelpCircle } from 'lucide-react';

interface SlidoverSettingsProps {
  currentLab?: string;
}

export const SlidoverSettings: React.FC<SlidoverSettingsProps> = ({ currentLab = "City Diagnostic" }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Invisible Hover Trigger Zone on the right edge of the screen */}
      <div 
        className="fixed top-0 right-0 h-screen w-4 z-40 bg-transparent cursor-pointer"
        onMouseEnter={() => setIsOpen(true)}
      />

      {/* Backdrop Overlay (Fades in when open, optional but good for focus) */}
      <div 
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity duration-300 z-40 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* Main Slide-out Panel */}
      <div 
        onMouseLeave={() => setIsOpen(false)}
        className={`fixed top-0 right-0 h-screen w-80 bg-white shadow-2xl border-l border-slate-100 transform transition-transform duration-300 ease-out z-50 flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600 animate-spin-slow" />
            <h2 className="font-semibold text-slate-800">Control Panel</h2>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content / Configuration Sections */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          
          {/* Section 1: Context Info */}
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Active Scope</span>
            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100/60">
              <p className="text-xs text-slate-500">Current Portal</p>
              <p className="text-sm font-semibold text-blue-700">{currentLab}</p>
            </div>
          </div>

          {/* Section 2: Preferences */}
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">Preferences</span>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <span className="text-sm text-slate-600">Auto-refresh records</span>
                <input type="checkbox" defaultChecked className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300" />
              </label>
              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                <span className="text-sm text-slate-600">Sound Notifications</span>
                <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300" />
              </label>
            </div>
          </div>

          {/* Section 3: Navigation Quick Links */}
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Management</span>
            <nav className="space-y-1">
              <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors group">
                <Sliders className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                <span>Filter Configurations</span>
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors group">
                <Bell className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                <span>Reminder Delays</span>
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors group">
                <Shield className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                <span>Staff Access Control</span>
              </button>
            </nav>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 text-center">
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" /> LabOps System v1.0.4
          </p>
        </div>
      </div>
    </>
  );
};
