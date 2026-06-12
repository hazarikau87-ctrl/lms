import React, { useState } from 'react';
import { Settings, Sliders, Shield, Bell, HelpCircle, LayoutDashboard, TrendingUp } from 'lucide-react';

interface SlidoverSettingsProps {
  currentLab?: string;
  currentView: 'dashboard' | 'revenue' | 'settings';
  setCurrentView: (view: 'dashboard' | 'revenue' | 'settings') => void;
}

export const SlidoverSettings: React.FC<SlidoverSettingsProps> = ({ 
  currentLab = "City Diagnostic",
  currentView,
  setCurrentView
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <aside 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed top-0 left-0 h-screen bg-white shadow-xl border-r border-slate-200/80 transition-all duration-300 ease-in-out z-50 flex flex-col overflow-hidden select-none ${
        isHovered ? 'w-64' : 'w-16'
      }`}
    >
      {/* Header / Brand Area */}
      <div className="h-16 border-b border-slate-100 flex items-center px-4 bg-slate-50/50 gap-4 flex-shrink-0">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
          <Settings className={`w-4 h-4 text-white transition-transform duration-700 ${isHovered ? 'rotate-90' : ''}`} />
        </div>
        <span className={`font-bold text-slate-800 text-sm whitespace-nowrap transition-opacity duration-200 ${
          isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}>
          Control Panel
        </span>
      </div>

      {/* Nav Content / Quick Options */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-6 custom-scrollbar">
        
        {/* Core Navigation Section */}
        <div>
          <span className={`text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1 mb-2 transition-opacity duration-200 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}>
            Navigation
          </span>
          <nav className="space-y-1">
            <button 
              onClick={() => setCurrentView('dashboard')}
              className={`w-full flex items-center gap-4 px-2.5 py-2.5 text-xs font-semibold rounded-xl transition-all group ${
                currentView === 'dashboard' 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className={`w-4 h-4 flex-shrink-0 ${currentView === 'dashboard' ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-600'}`} />
              <span className={`whitespace-nowrap transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                Dashboard
              </span>
            </button>

            {/* Added Revenue Panel Toggle */}
            <button 
              onClick={() => setCurrentView('revenue')}
              className={`w-full flex items-center gap-4 px-2.5 py-2.5 text-xs font-semibold rounded-xl transition-all group ${
                currentView === 'revenue' 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <TrendingUp className={`w-4 h-4 flex-shrink-0 ${currentView === 'revenue' ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-600'}`} />
              <span className={`whitespace-nowrap transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                Revenue Analytics
              </span>
            </button>

            <button 
              onClick={() => setCurrentView('settings')}
              className={`w-full flex items-center gap-4 px-2.5 py-2.5 text-xs font-semibold rounded-xl transition-all group ${
                currentView === 'settings' 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Settings className={`w-4 h-4 flex-shrink-0 ${currentView === 'settings' ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-600'}`} />
              <span className={`whitespace-nowrap transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                System Settings
              </span>
            </button>
          </nav>
        </div>

        {/* Management Quick Actions Section */}
        <div>
          <span className={`text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1 mb-2 transition-opacity duration-200 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}>
            Management
          </span>
          <nav className="space-y-1">
            <button className="w-full flex items-center gap-4 px-2.5 py-2.5 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-all group">
              <Sliders className="w-4 h-4 text-slate-400 group-hover:text-blue-600 flex-shrink-0" />
              <span className={`whitespace-nowrap transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>Filters Config</span>
            </button>
            <button className="w-full flex items-center gap-4 px-2.5 py-2.5 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-all group">
              <Bell className="w-4 h-4 text-slate-400 group-hover:text-blue-600 flex-shrink-0" />
              <span className={`whitespace-nowrap transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>Reminder Delays</span>
            </button>
            <button className="w-full flex items-center gap-4 px-2.5 py-2.5 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-all group">
              <Shield className="w-4 h-4 text-slate-400 group-hover:text-blue-600 flex-shrink-0" />
              <span className={`whitespace-nowrap transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>Staff Access</span>
            </button>
          </nav>
        </div>

        {/* Context Scope Info Panel */}
        {isHovered && (
          <div className="pt-2 animate-[fadeIn_0.2s_ease]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1 mb-2">Active Scope</span>
            <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-100/60">
              <p className="text-[10px] text-slate-400 font-medium">Current Portal</p>
              <p className="text-xs font-bold text-blue-700 truncate">{currentLab}</p>
            </div>
          </div>
        )}

      </div>

      {/* Footer System Version */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-start gap-4 flex-shrink-0">
        <HelpCircle className="w-4 h-4 text-slate-400 flex-shrink-0 ml-1" />
        <span className={`text-[11px] font-medium text-slate-400 whitespace-nowrap transition-opacity duration-200 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}>
          v1.0.4
        </span>
      </div>
    </aside>
  );
};