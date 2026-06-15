import React, { useState } from 'react';
import { useGenerationLimit } from '../lib/hooks/useGenerationLimit';
import { UpgradeModal } from './modals/UpgradeModal';
import { Loader2 } from 'lucide-react';

interface GenerationLimitCheckerProps {
  children: React.ReactNode;
  onLimitExceeded?: () => void;
}

export function GenerationLimitChecker({ children, onLimitExceeded }: GenerationLimitCheckerProps) {
  const { allowed, loading } = useGenerationLimit();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // We are assuming the specific triggers are children that will fire their own routines,
  // but if the limit is exceeded, we might want to block interactions entirely or wrap buttons.
  // Actually, the prompt says it should check limit BEFORE generating, but we can't easily intercept all clicks.
  // A better pattern for React children is to provide context or expose a render prop, but the user requested:
  // "Envolver a rota de geração em GenerationLimitChecker".
  
  // Here we block the whole block if loading, or just show a warning. 
  // Wait, if we want to check ON CLICK, we should just use the hook in App.tsx. The user prompted:
  // "Antes de chamar API Gemini: 1. Chamar useGenerationLimit(). Se !allowed: mostrar UpgradeModal."
  
  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 text-[#00ff88]">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  return (
    <>
      {showUpgradeModal && (
        <UpgradeModal onClose={() => setShowUpgradeModal(false)} />
      )}
      
      {/* We pass down a styled overlay or just render children normally if allowed. */}
      {/* If not allowed, we could either intercept clicks using a wrapper or disable generate button inside App.tsx */}
      <div className={!allowed ? "relative" : ""}>
        {children}
        
        {!allowed && (
          <div 
            className="absolute inset-0 z-10 bg-black/20 cursor-not-allowed"
            onClickCapture={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setShowUpgradeModal(true);
              if (onLimitExceeded) onLimitExceeded();
            }}
          />
        )}
      </div>
    </>
  );
}
