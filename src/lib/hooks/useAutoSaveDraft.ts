import { useState, useEffect, useCallback, useRef } from 'react';

export function useAutoSaveDraft<T>(key: string, initialData: T) {
  const [data, setData] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.data !== undefined ? parsed.data : initialData;
      }
    } catch (e) {
      console.warn(`Erro ao carregar rascunho de ${key}:`, e);
    }
    return initialData;
  });

  const [lastSaved, setLastSaved] = useState<Date | null>(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.timestamp) return new Date(parsed.timestamp);
      }
    } catch (e) {
      // Ignore
    }
    return null;
  });

  const [isSaved, setIsSaved] = useState<boolean>(true);
  const timerRef = useRef<any>(null);

  const save = useCallback((newData: T) => {
    setData(newData);
    setIsSaved(false);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      try {
        const timestamp = new Date();
        localStorage.setItem(key, JSON.stringify({ data: newData, timestamp: timestamp.toISOString() }));
        setLastSaved(timestamp);
        setIsSaved(true);
      } catch (err) {
        console.error(`Falha ao salvar rascunho de ${key}:`, err);
      }
    }, 600);
  }, [key]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setData(initialData);
      setLastSaved(null);
      setIsSaved(true);
    } catch (err) {
      console.error(`Falha ao limpar rascunho de ${key}:`, err);
    }
  }, [key, initialData]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    data,
    save,
    clear,
    lastSaved,
    isSaved,
    hasDraft: lastSaved !== null
  };
}
