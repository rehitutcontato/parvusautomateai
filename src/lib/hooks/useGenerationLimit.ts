import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { checkGenerationLimit } from '../services/generationLimitService';

export interface GenerationLimitStatus {
  allowed: boolean;
  usedThisMonth: number;
  limit: number;
  plan: string;
  remainingGenerations: number;
  loading: boolean;
}

export function useGenerationLimit() {
  const [status, setStatus] = useState<GenerationLimitStatus>({
    allowed: true, // Default to true so users without session can generate
    usedThisMonth: 0,
    limit: 0,
    plan: 'free',
    remainingGenerations: 0,
    loading: true,
  });

  const refreshLimit = async () => {
    setStatus(prev => ({ ...prev, loading: true }));
    if (!supabase) {
      const guestCount = parseInt(localStorage.getItem('parvus_free_generations_done') || '0', 10);
      const allowed = guestCount < 1;
      setStatus({
        allowed,
        usedThisMonth: guestCount,
        limit: 1,
        plan: 'free',
        remainingGenerations: allowed ? 1 - guestCount : 0,
        loading: false,
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const guestCount = parseInt(localStorage.getItem('parvus_free_generations_done') || '0', 10);
        const allowed = guestCount < 1;
        setStatus({
          allowed,
          usedThisMonth: guestCount,
          limit: 1,
          plan: 'free',
          remainingGenerations: allowed ? 1 - guestCount : 0,
          loading: false,
        });
        return;
      }

      const result = await checkGenerationLimit(session.user.id, supabase);
      
      setStatus({
        allowed: result.allowed,
        usedThisMonth: result.usedThisMonth,
        limit: result.limit,
        plan: result.plan,
        remainingGenerations: result.remaining,
        loading: false,
      });
    } catch (e) {
      console.error(e);
      setStatus(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    refreshLimit();
  }, []);

  return { ...status, refreshLimit };
}
