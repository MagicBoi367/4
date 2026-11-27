import { useCallback, useEffect, useState } from 'react';

export interface NotificationPreferences {
  classNotifications: boolean;
  examNotifications: boolean;
  otherNotifications: boolean;
}

const NOTIF_PREFS_STORAGE_KEY = 'kythi2025_notification_prefs_v1';
const NOTIF_PREFS_EVENT = 'kythi2025:notification-prefs-updated';

const DEFAULT_PREFS: NotificationPreferences = {
  classNotifications: true,
  examNotifications: true,
  otherNotifications: true,
};

function readInitialNotificationPreferences(): NotificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(NOTIF_PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      classNotifications:
        typeof parsed.classNotifications === 'boolean' ? parsed.classNotifications : true,
      examNotifications:
        typeof parsed.examNotifications === 'boolean' ? parsed.examNotifications : true,
      otherNotifications:
        typeof parsed.otherNotifications === 'boolean' ? parsed.otherNotifications : true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function useNotificationPreferences() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(
    readInitialNotificationPreferences,
  );

  useEffect(() => {
    try {
      localStorage.setItem(NOTIF_PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage quota errors
    }
  }, [prefs]);

  useEffect(() => {
    const handleSync = (e: Event) => {
      const custom = e as CustomEvent<NotificationPreferences>;
      if (custom.detail && typeof custom.detail === 'object') {
        setPrefs(custom.detail);
      }
    };
    window.addEventListener(NOTIF_PREFS_EVENT, handleSync);
    return () => window.removeEventListener(NOTIF_PREFS_EVENT, handleSync);
  }, []);

  const togglePref = useCallback((key: keyof NotificationPreferences) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent<NotificationPreferences>(NOTIF_PREFS_EVENT, { detail: next }),
        );
      }
      return next;
    });
  }, []);

  const setAllPrefs = useCallback((enabled: boolean) => {
    setPrefs(() => {
      const next: NotificationPreferences = {
        classNotifications: enabled,
        examNotifications: enabled,
        otherNotifications: enabled,
      };
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent<NotificationPreferences>(NOTIF_PREFS_EVENT, { detail: next }),
        );
      }
      return next;
    });
  }, []);

  return {
    prefs,
    togglePref,
    setAllPrefs,
  };
}
