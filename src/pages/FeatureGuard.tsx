// components/FeatureGuard.tsx
import React, { ReactNode } from 'react';

interface FeatureGuardProps {
  featureId?: string;                 // To differentiate features down the line if needed
  fallbackMode?: 'hide' | 'lockout';   // Choose whether to completely hide it, or show a locked variant
  children: ReactNode;
}

export function FeatureGuard({ 
  featureId, 
  fallbackMode = 'lockout', 
  children 
}: FeatureGuardProps) {
  
  // Single ground-truth reading of the tier status
  const userTier = localStorage.getItem('user_tier') || 'free';
  const isFreeUser = userTier === 'free';

  // If the user has premium access, seamlessly render the actual code inside
  if (!isFreeUser) {
    return <>{children}</>;
  }

  // Otherwise, handle the restriction rules gracefully based on your layout needs
  if (fallbackMode === 'hide') {
    return null;
  }

  return (
    <div className="relative group cursor-not-allowed w-full">
      {/* 1. Visual lock container style overlay */}
      <div className="absolute inset-0 bg-slate-50/40 backdrop-blur-[0.5px] rounded-lg border border-dashed border-slate-200 z-10 flex items-center justify-center transition-all group-hover:bg-slate-100/60" />
      
      {/* 2. Lock notification button display */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation(); // Stop background actions from triggering
          alert(`The feature is locked on the Free Tier. Please upgrade your plan to activate it.`);
        }}
        className="w-full relative z-20 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white text-slate-400 border border-slate-200 rounded-lg text-[10px] font-bold transition hover:text-slate-600 hover:border-slate-300 shadow-2xs"
      >
        <span>🔒</span>
        <span>Premium Feature</span>
      </button>

      {/* Hidden layout shell to preserve correct flex/grid component sizing */}
      <div className="opacity-0 pointer-events-none select-none h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
