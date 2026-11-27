import {
  AlertTriangle,
  Bell,
  BellOff,
  Check,
  ClipboardList,
  Eraser,
  Globe,
  GraduationCap,
  Headphones,
  Info,
  Keyboard,
  LogIn,
  LogOut,
  MessageSquare,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Settings,
  Sun,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FontSizeScale } from '../hooks/useFontSize';
import type { NotificationPreferences } from '../hooks/useNotificationPreferences';
import type { UserAccount, UserRole } from '../types/exam';
import { deleteOwnAccount } from '../utils/authStore';
import { useLanguage } from '../utils/i18n';
import { getSupportThreadIdForUser, useSupportChats } from '../utils/supportChatStore';

const APP_VERSION = 'v2.5.0';

interface SettingsModalProps {
  role: UserRole;
  currentUser: UserAccount | null;
  isDark: boolean;
  onToggleTheme: () => void;
  fontSize: FontSizeScale;
  onChangeFontSize: (size: FontSizeScale) => void;
  rightSidebarCollapsed: boolean;
  onToggleRightSidebar: () => void;
  alertSoundEnabled: boolean;
  onToggleAlertSound: () => void;
  notificationPrefs: NotificationPreferences;
  onToggleNotificationPref: (key: keyof NotificationPreferences) => void;
  onSetAllNotifications: (enabled: boolean) => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onOpenProfile: (tab?: 'view_edit' | 'password') => void;
  onOpenAccountManager: (tab: 'create' | 'list') => void;
  onOpenShortcuts: () => void;
  onOpenSupportChat: () => void;
  onOpenIntro: () => void;
  onResetDemoData: () => void;
  onLogout: () => void;
  onAccountDeleted: () => void;
  onClose: () => void;
}

export function SettingsModal({
  role,
  currentUser,
  isDark,
  onToggleTheme,
  fontSize,
  onChangeFontSize,
  rightSidebarCollapsed,
  onToggleRightSidebar,
  alertSoundEnabled,
  onToggleAlertSound,
  notificationPrefs,
  onToggleNotificationPref,
  onSetAllNotifications,
  onOpenAuth,
  onOpenShortcuts,
  onOpenSupportChat,
  onOpenIntro,
  onResetDemoData,
  onLogout,
  onAccountDeleted,
  onClose,
}: SettingsModalProps) {
  const { language, setLanguage, t, tx } = useLanguage();
  const supportThreads = useSupportChats();
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [cacheClearing, setCacheClearing] = useState(false);
  const [cacheClearedCount, setCacheClearedCount] = useState<number | null>(null);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  const isStaff = role === 'teacher' || role === 'admin';
  const isAdmin = currentUser?.role === 'admin' || (!currentUser && role === 'admin');
  const allNotificationsEnabled =
    notificationPrefs.classNotifications &&
    notificationPrefs.examNotifications &&
    notificationPrefs.otherNotifications &&
    (!isStaff || alertSoundEnabled);

  const unreadSupportCount = useMemo(() => {
    if (isAdmin) {
      return supportThreads.reduce((sum, th) => sum + (th.unreadForAdmin || 0), 0);
    }
    const threadId = getSupportThreadIdForUser(currentUser);
    const mine = supportThreads.find((th) => th.id === threadId);
    return mine?.unreadForUser ?? 0;
  }, [currentUser, isAdmin, supportThreads]);

  const handleConfirmDeleteAccount = () => {
    if (!currentUser) return;
    setDeleteAccountError(null);
    const res = deleteOwnAccount(currentUser.id);
    if (!res.ok) {
      setDeleteAccountError(
        res.errorCode === 'last_admin'
          ? t.deleteAccountLastAdminError
          : t.deleteAccountGuestHint,
      );
      return;
    }
    setConfirmDeleteAccount(false);
    onAccountDeleted();
  };

  const handleClearCache = async () => {
    setCacheClearing(true);
    let removedItems = 0;
    try {
      const tempLocalKeys = [
        'kythi2025_footer_spark_idx_v1',
        'kythi2025_guest_support_id_v1',
      ];
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith('kythi2025_draft_') || tempLocalKeys.includes(key)) {
          localStorage.removeItem(key);
          removedItems += 1;
        }
      }

      const tempSessionKeys = [
        'kythi2025_guest_sub_ids_v1',
        'kythi2025_reset_otp_v1',
      ];
      for (const key of tempSessionKeys) {
        if (sessionStorage.getItem(key) !== null) {
          sessionStorage.removeItem(key);
          removedItems += 1;
        }
      }

      if (typeof window !== 'undefined' && 'caches' in window) {
        const cacheNames = await window.caches.keys();
        for (const name of cacheNames) {
          const deleted = await window.caches.delete(name);
          if (deleted) removedItems += 1;
        }
      }
    } catch {
      // Ignore browser storage/cache restrictions
    } finally {
      setCacheClearing(false);
      setCacheClearedCount(removedItems);
      window.setTimeout(() => setCacheClearedCount(null), 3500);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs dark:bg-slate-950/80"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Settings className="h-5 w-5 text-blue-700 dark:text-blue-400" />
            <h2
              id="settings-modal-title"
              className="font-display text-base font-bold text-slate-900 sm:text-lg dark:text-slate-50"
            >
              {t.settingsTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.settingsCloseAria}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 p-6">
          {/* Appearance & Language */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              {t.sectionAppearance}
            </h3>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {/* Theme Mode (Light / Dark) */}
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex items-center gap-3">
                  {isDark ? (
                    <Moon className="h-4 w-4 shrink-0 text-blue-400" />
                  ) : (
                    <Sun className="h-4 w-4 shrink-0 text-amber-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {t.themeLabel}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isDark ? t.themeDarkHint : t.themeLightHint}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isDark}
                  onClick={onToggleTheme}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                    isDark ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      isDark ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Language Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {t.languageLabel}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.languageHint}
                    </p>
                  </div>
                </div>
                <div
                  role="group"
                  aria-label={t.languageLabel}
                  className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800"
                >
                  <button
                    type="button"
                    onClick={() => setLanguage('vi')}
                    aria-pressed={language === 'vi'}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                      language === 'vi'
                        ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-400'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                    }`}
                  >
                    <svg
                      viewBox="0 0 30 20"
                      aria-hidden="true"
                      className="h-3 w-4 rounded-[2px] ring-1 ring-black/10 dark:ring-white/15"
                    >
                      <rect width="30" height="20" fill="#DA251D" />
                      <polygon
                        points="15,4 16.35,8.15 20.71,8.15 17.18,10.71 18.53,14.85 15,12.29 11.47,14.85 12.82,10.71 9.29,8.15 13.65,8.15"
                        fill="#FFFF00"
                      />
                    </svg>
                    <span>{t.languageVi}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    aria-pressed={language === 'en'}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                      language === 'en'
                        ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-400'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                    }`}
                  >
                    <svg
                      viewBox="0 0 60 40"
                      aria-hidden="true"
                      className="h-3 w-4 rounded-[2px] ring-1 ring-black/10 dark:ring-white/15"
                    >
                      <rect width="60" height="40" fill="#012169" />
                      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#FFFFFF" strokeWidth="8" />
                      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" strokeWidth="4" />
                      <path d="M30,0 L30,40 M0,20 L60,20" stroke="#FFFFFF" strokeWidth="12" />
                      <path d="M30,0 L30,40 M0,20 L60,20" stroke="#C8102E" strokeWidth="7" />
                    </svg>
                    <span>{t.languageEn}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex items-center gap-3">
                  {rightSidebarCollapsed ? (
                    <PanelRightOpen className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  ) : (
                    <PanelRightClose className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {t.sidebarLabel}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {rightSidebarCollapsed
                        ? t.sidebarCollapsedHint
                        : t.sidebarExpandedHint}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={rightSidebarCollapsed}
                  onClick={onToggleRightSidebar}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                    rightSidebarCollapsed ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      rightSidebarCollapsed ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Font Size Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Type className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {t.fontSizeLabel}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.fontSizeHint}
                    </p>
                  </div>
                </div>
                <div
                  role="group"
                  aria-label={t.fontSizeLabel}
                  className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800"
                >
                  {(
                    [
                      { id: 'small', label: t.fontSizeSmall },
                      { id: 'medium', label: t.fontSizeMedium },
                      { id: 'large', label: t.fontSizeLarge },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChangeFontSize(opt.id)}
                      aria-pressed={fontSize === opt.id}
                      className={`cursor-pointer whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                        fontSize === opt.id
                          ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-400'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Notifications & Alerts */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                {t.sectionNotifications}
              </h3>
              <button
                type="button"
                aria-pressed={allNotificationsEnabled}
                onClick={() => onSetAllNotifications(!allNotificationsEnabled)}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  allNotificationsEnabled
                    ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                    : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-950'
                }`}
              >
                {allNotificationsEnabled ? (
                  <>
                    <BellOff className="h-3.5 w-3.5" />
                    <span>{t.toggleAllOffBtn}</span>
                  </>
                ) : (
                  <>
                    <Bell className="h-3.5 w-3.5" />
                    <span>{t.toggleAllOnBtn}</span>
                  </>
                )}
              </button>
            </div>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {/* Classroom Notifications */}
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex items-center gap-3">
                  <GraduationCap
                    className={`h-4 w-4 shrink-0 ${
                      notificationPrefs.classNotifications
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {t.classNotifLabel}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.classNotifHint}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notificationPrefs.classNotifications}
                  onClick={() => onToggleNotificationPref('classNotifications')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                    notificationPrefs.classNotifications
                      ? 'bg-blue-600'
                      : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      notificationPrefs.classNotifications ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Exam Notifications */}
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex items-center gap-3">
                  <ClipboardList
                    className={`h-4 w-4 shrink-0 ${
                      notificationPrefs.examNotifications
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {t.examNotifLabel}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.examNotifHint}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notificationPrefs.examNotifications}
                  onClick={() => onToggleNotificationPref('examNotifications')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                    notificationPrefs.examNotifications
                      ? 'bg-blue-600'
                      : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      notificationPrefs.examNotifications ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Other Message & System Notifications */}
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex items-center gap-3">
                  <MessageSquare
                    className={`h-4 w-4 shrink-0 ${
                      notificationPrefs.otherNotifications
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {t.otherNotifLabel}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.otherNotifHint}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notificationPrefs.otherNotifications}
                  onClick={() => onToggleNotificationPref('otherNotifications')}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                    notificationPrefs.otherNotifications
                      ? 'bg-blue-600'
                      : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      notificationPrefs.otherNotifications ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Live Alert Sound (Staff) */}
              {isStaff && (
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex items-center gap-3">
                    {alertSoundEnabled ? (
                      <Bell className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <BellOff className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {t.alertSoundLabel}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t.alertSoundHint}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={alertSoundEnabled}
                    onClick={onToggleAlertSound}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                      alertSoundEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                        alertSoundEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* System & Support */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              {t.sectionSystemSupport}
            </h3>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSupportChat();
                }}
                className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-50/50 dark:hover:bg-slate-800/60"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Headphones className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {t.supportChatLabel}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isAdmin ? t.supportChatHintAdmin : t.supportChatHintUser}
                    </p>
                  </div>
                </div>
                <span className="flex shrink-0 items-center gap-1.5">
                  {notificationPrefs.otherNotifications && unreadSupportCount > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 font-mono text-[10px] font-bold text-white tabular-nums">
                      {unreadSupportCount}
                    </span>
                  )}
                  <span className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                    {t.supportChatOpenBtn}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenShortcuts();
                }}
                className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <span className="flex items-center gap-3">
                  <Keyboard className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {t.shortcutsLabel}
                  </span>
                </span>
                <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  ?
                </kbd>
              </button>

              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Eraser className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {t.clearCacheLabel}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {cacheClearedCount !== null
                        ? `${t.clearCacheDoneHint}${
                            cacheClearedCount > 0
                              ? ` (${cacheClearedCount} ${tx('mục', 'items')})`
                              : ''
                          }`
                        : t.clearCacheHint}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={cacheClearing}
                  onClick={() => void handleClearCache()}
                  className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    cacheClearedCount !== null
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {cacheClearedCount !== null && <Check className="h-3.5 w-3.5" />}
                  <span>
                    {cacheClearing
                      ? tx('Đang xóa...', 'Clearing...')
                      : cacheClearedCount !== null
                        ? tx('Đã xóa', 'Cleared')
                        : t.clearCacheBtn}
                  </span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <RotateCcw className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {t.resetDemoLabel}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {resetDone ? t.resetDemoDoneHint : t.resetDemoHint}
                    </p>
                  </div>
                </div>
                {confirmReset ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onResetDemoData();
                        setConfirmReset(false);
                        setResetDone(true);
                        setTimeout(() => setResetDone(false), 3000);
                      }}
                      className="cursor-pointer rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-700"
                    >
                      {t.confirmBtn}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="cursor-pointer rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {t.cancelBtn}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="cursor-pointer rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {t.resetDemoBtn}
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Account & Session Management */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              {t.sectionDangerZone}
            </h3>

            {/* Sign out / Sign in row */}
            <div className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-800">
              {currentUser ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <LogOut className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {t.logoutLabel}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {currentUser.fullName} ·{' '}
                        <span className="font-mono">{currentUser.id}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onLogout();
                    }}
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>{t.logoutBtn}</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <LogIn className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {t.logoutLabel}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t.logoutGuestHint}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAuth('login');
                    }}
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span>{t.loginNowBtn}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50/40 p-4 dark:border-red-900/60 dark:bg-red-950/20">
              {!currentUser ? (
                <div className="flex items-start gap-3">
                  <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {t.deleteAccountLabel}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {t.deleteAccountGuestHint}
                    </p>
                  </div>
                </div>
              ) : confirmDeleteAccount ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-red-700 dark:text-red-300">
                        {t.deleteAccountConfirmTitle} ({currentUser.fullName} · {currentUser.id})
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {t.deleteAccountConfirmDesc}
                      </p>
                    </div>
                  </div>
                  {deleteAccountError && (
                    <p className="rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-slate-900 dark:text-red-300">
                      {deleteAccountError}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeleteAccount(false);
                        setDeleteAccountError(null);
                      }}
                      className="cursor-pointer rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      {t.cancelBtn}
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDeleteAccount}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{t.deleteAccountConfirmBtn}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {t.deleteAccountLabel}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                        {t.deleteAccountHint}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteAccountError(null);
                      setConfirmDeleteAccount(true);
                    }}
                    className="shrink-0 cursor-pointer rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 dark:border-red-800 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/60"
                  >
                    {t.deleteAccountBtn}
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Version Information & About */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
              {t.sectionAppInfo}
            </h3>
            <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-slate-50/70 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950/50">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenIntro();
                }}
                className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-50/60 dark:hover:bg-slate-800/60"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {t.navIntroFull}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {tx(
                        'Xem thông tin tổng quan về nền tảng thi trực tuyến NTPEXION',
                        'View overview and details about the NTPEXION platform',
                      )}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                  {tx('Xem', 'View')}
                </span>
              </button>

              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Info className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {t.appVersionLabel}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.appVersionDetail}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block rounded-md border border-slate-200 bg-white px-2.5 py-0.5 font-mono text-xs font-bold text-slate-800 tabular-nums dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                    {APP_VERSION}
                  </span>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {t.appBuildTag}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-200 px-6 py-3.5 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            {t.settingsCloseBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
