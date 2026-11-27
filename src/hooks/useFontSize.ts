import { useCallback, useEffect, useState } from 'react';

export type FontSizeScale = 'small' | 'medium' | 'large';

const FONT_SIZE_STORAGE_KEY = 'kythi2025_font_size_v1';
const FONT_SIZE_EVENT = 'kythi2025:font-size-updated';

const FONT_SIZE_PX_MAP: Record<FontSizeScale, string> = {
  small: '16px',
  medium: '18px',
  large: '20px',
};

function getInitialFontSize(): FontSizeScale {
  if (typeof window === 'undefined') return 'medium';
  try {
    const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (saved === 'small' || saved === 'medium' || saved === 'large') {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'medium';
}

export function applyFontSizeScale(scale: FontSizeScale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.fontSize = FONT_SIZE_PX_MAP[scale];
}

export function useFontSize() {
  const [fontSize, setFontSizeState] = useState<FontSizeScale>(getInitialFontSize);

  useEffect(() => {
    applyFontSizeScale(fontSize);
    try {
      localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSize);
    } catch {
      // Ignore storage quota errors
    }
  }, [fontSize]);

  useEffect(() => {
    const handleSync = (e: Event) => {
      const custom = e as CustomEvent<FontSizeScale>;
      if (custom.detail === 'small' || custom.detail === 'medium' || custom.detail === 'large') {
        setFontSizeState(custom.detail);
      }
    };
    window.addEventListener(FONT_SIZE_EVENT, handleSync);
    return () => window.removeEventListener(FONT_SIZE_EVENT, handleSync);
  }, []);

  const setFontSize = useCallback((next: FontSizeScale) => {
    setFontSizeState(next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent<FontSizeScale>(FONT_SIZE_EVENT, { detail: next }));
    }
  }, []);

  return {
    fontSize,
    setFontSize,
  };
}
