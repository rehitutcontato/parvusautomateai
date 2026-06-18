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
      setStatus(prev => ({ ...prev, allowed: true, loading: false }));
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus(prev => ({ ...prev, allowed: true, loading: false }));
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
