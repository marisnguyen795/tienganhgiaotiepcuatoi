import { useCallback, useEffect, useState } from 'react';

export type DrillRecord = {
  date: string;
  correctCount: number;
  totalCount: number;
  avgSeconds: number;
};

export type UserProgress = {
  masteredSituationIds: number[];
  masteredWordKeys: string[];
  favoriteSituationIds: number[];
  completedDrillsCount: number;
  streakDays: number;
  lastPracticeDate: string | null;
  drillHistory: DrillRecord[];
};

const STORAGE_KEY = 'anh_van_phan_xa_progress_v1';

const DEFAULT_PROGRESS: UserProgress = {
  masteredSituationIds: [],
  masteredWordKeys: [],
  favoriteSituationIds: [],
  completedDrillsCount: 0,
  streakDays: 0,
  lastPracticeDate: null,
  drillHistory: [],
};

function getTodayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getYesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function updateStreak(prev: UserProgress): { streakDays: number; lastPracticeDate: string } {
  const today = getTodayIso();
  const yesterday = getYesterdayIso();

  if (prev.lastPracticeDate === today) {
    return { streakDays: Math.max(1, prev.streakDays), lastPracticeDate: today };
  }
  if (prev.lastPracticeDate === yesterday) {
    return { streakDays: prev.streakDays + 1, lastPracticeDate: today };
  }
  return { streakDays: 1, lastPracticeDate: today };
}

export function makeWordKey(situationId: number, en: string): string {
  return `${situationId}::${en.toLowerCase()}`;
}

export function useLocalProgress() {
  const [progress, setProgress] = useState<UserProgress>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_PROGRESS;
      const parsed = JSON.parse(raw) as Partial<UserProgress>;
      return {
        ...DEFAULT_PROGRESS,
        ...parsed,
        masteredSituationIds: Array.isArray(parsed.masteredSituationIds) ? parsed.masteredSituationIds : [],
        masteredWordKeys: Array.isArray(parsed.masteredWordKeys) ? parsed.masteredWordKeys : [],
        favoriteSituationIds: Array.isArray(parsed.favoriteSituationIds) ? parsed.favoriteSituationIds : [],
        drillHistory: Array.isArray(parsed.drillHistory) ? parsed.drillHistory : [],
      };
    } catch {
      return DEFAULT_PROGRESS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Ignore storage quota errors
    }
  }, [progress]);

  const toggleMasteredSituation = useCallback((situationId: number) => {
    setProgress((prev) => {
      const exists = prev.masteredSituationIds.includes(situationId);
      const nextIds = exists
        ? prev.masteredSituationIds.filter((id) => id !== situationId)
        : [...prev.masteredSituationIds, situationId];
      const streak = exists
        ? { streakDays: prev.streakDays, lastPracticeDate: prev.lastPracticeDate }
        : updateStreak(prev);
      return {
        ...prev,
        ...streak,
        masteredSituationIds: nextIds,
      };
    });
  }, []);

  const toggleFavoriteSituation = useCallback((situationId: number) => {
    setProgress((prev) => {
      const exists = prev.favoriteSituationIds.includes(situationId);
      const nextFavs = exists
        ? prev.favoriteSituationIds.filter((id) => id !== situationId)
        : [...prev.favoriteSituationIds, situationId];
      return {
        ...prev,
        favoriteSituationIds: nextFavs,
      };
    });
  }, []);

  const toggleMasteredWord = useCallback((wordKey: string) => {
    setProgress((prev) => {
      const exists = prev.masteredWordKeys.includes(wordKey);
      const nextWords = exists
        ? prev.masteredWordKeys.filter((k) => k !== wordKey)
        : [...prev.masteredWordKeys, wordKey];
      const streak = exists
        ? { streakDays: prev.streakDays, lastPracticeDate: prev.lastPracticeDate }
        : updateStreak(prev);
      return {
        ...prev,
        ...streak,
        masteredWordKeys: nextWords,
      };
    });
  }, []);

  const recordDrillSession = useCallback((correctCount: number, totalCount: number, avgSeconds: number) => {
    setProgress((prev) => {
      const streak = updateStreak(prev);
      const entry: DrillRecord = {
        date: getTodayIso(),
        correctCount,
        totalCount,
        avgSeconds: Number(avgSeconds.toFixed(1)),
      };
      return {
        ...prev,
        ...streak,
        completedDrillsCount: prev.completedDrillsCount + 1,
        drillHistory: [entry, ...prev.drillHistory].slice(0, 20),
      };
    });
  }, []);

  const resetAllProgress = useCallback(() => {
    setProgress(DEFAULT_PROGRESS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  return {
    progress,
    toggleMasteredSituation,
    toggleFavoriteSituation,
    toggleMasteredWord,
    recordDrillSession,
    resetAllProgress,
  };
}
