
import { useState, useCallback, useEffect } from 'react';

const getTodayDateString = () => new Date().toISOString().split('T')[0];

interface DailyCount {
  date: string;
  count: number;
}

/**
 * Hook para contar extrações diárias. 
 * O limite foi removido conforme solicitado pelo usuário.
 */
export const useDailyCounter = (): [number, () => void] => {
  const [count, setCount] = useState<number>(0);

  const getStoredCount = useCallback((): DailyCount => {
    try {
      const item = window.localStorage.getItem('dailyExtractionCount');
      if (item) {
        const parsed = JSON.parse(item);
        if (typeof parsed.date === 'string' && typeof parsed.count === 'number') {
          return parsed;
        }
      }
    } catch (error) {
      console.error("Error reading daily count from localStorage", error);
    }
    return { date: getTodayDateString(), count: 0 };
  }, []);

  useEffect(() => {
    const stored = getStoredCount();
    const today = getTodayDateString();
    if (stored.date === today) {
      setCount(stored.count);
    } else {
      window.localStorage.setItem('dailyExtractionCount', JSON.stringify({ date: today, count: 0 }));
      setCount(0);
    }
  }, [getStoredCount]);

  const increment = useCallback(() => {
    setCount(prevCount => {
      const newCount = prevCount + 1;
      const today = getTodayDateString();
      window.localStorage.setItem('dailyExtractionCount', JSON.stringify({ date: today, count: newCount }));
      return newCount;
    });
  }, []);

  return [count, increment];
};
