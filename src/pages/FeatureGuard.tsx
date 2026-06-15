// components/FeatureGuard.tsx
import React, { ReactNode } from 'react';

// Strict production billing tiers (Standard free tier is completely removed)
export type UserTier = '499' | '799' | '1499';

const TIER_WEIGHTS: Record<UserTier, number> = {
  '499': 1,
  '799': 2,
  '1499': 3,
};

interface FeatureGuardProps {
  /** The specific paid tier required once the 30-day demo expires */
  requiredTier: UserTier;
  featureId?: string;                 
  fallbackMode?: 'hide' | 'lockout';   
  onLockClick?: (requiredTier: UserTier) => void;
  children: ReactNode;
}

export function FeatureGuard({ 
  requiredTier,
  featureId, 
  fallbackMode = 'lockout', 
  onLockClick,
  children 
}: FeatureGuardProps) {
  
  // 1. Retrieve billing tier and demo tracking details
  const currentTier = localStorage.getItem('user_tier') as UserTier | null;
  const demoStartedAt = localStorage.getItem('demo_started_at'); // ISO format string: "2026-06-15T18:50:00.000Z"

  let hasAccess = false;

  // 2. Evaluate Access Control Engine
  if (currentTier && TIER_WEIGHTS[currentTier] !== undefined) {
    // Paid User Path: Verify if their active subscription tier satisfies the feature weight
    hasAccess = TIER_WEIGHTS[currentTier] >= TIER_WEIGHTS[requiredTier];
  } else if (demoStartedAt) {
    // Demo User Path: Validate if the 30-day trial window is still active
    const startTime = new Date(demoStartedAt).getTime();
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    const expirationTime = startTime + thirtyDaysInMs;
    const now = Date.now();

    if (now < expirationTime) {
      // Demo is active: grant full unhindered access to all features
      hasAccess = true;
    }
  }

  // 3. Render feature if authorization checks pass
  if (hasAccess) {
    return <>{children}</>;
  }

  // 4. Handle Restrictive Fallbacks for expired or unauthenticated profiles
  if (fallbackMode === 'hide') {
    return null;
  }

  const handleRestrictionClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (onLockClick) {
      onLockClick(requiredTier);
    } else {
      console.warn(`Feature [${featureId || 'unknown'}] is locked. Paid Tier ${requiredTier} or an active Demo is required.`);
    }
  };

  return (
    <div className="relative group w-full overflow-hidden rounded-xl border border-slate-200/60 bg-slate-50/30 p-1 transition-all duration-300 hover:border-indigo-200/80 hover:shadow-md hover:shadow-indigo-500/5">
      
      {/* Premium Glassmorphic Overlay */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[2px] transition-all duration-300 group-hover:bg-white/20" />
      
      {/* Premium Locked Call-to-Action */}
      <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
        <button
          type="button"
          onClick={handleRestrictionClick}
          className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/95 px-4 py-2 text-xs font-semibold text-indigo-600 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:border-indigo-300 hover:bg-indigo-600 hover:text-white hover:shadow-md hover:shadow-indigo-600/20 active:scale-[0.98]"
        >
          <svg 
            className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-12" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>Activate Tier {requiredTier} to Unlock</span>
        </button>
      </div>

      {/* Visually obfuscated child elements to maintain exact layout dimensions */}
      <div 
        className="pointer-events-none select-none opacity-25 filter blur-[1.5px]" 
        aria-hidden="true"
      >
        {children}
      </div>
    </div>
  );
}
