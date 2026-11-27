import {
  ExternalLink,
  KeyRound,
  LogIn,
  LogOut,
  Menu,
  PanelRightOpen,
  Pencil,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { NotificationPreferences } from '../hooks/useNotificationPreferences';
import type {
  ClassAssignment,
  ClassJoinRequest,
  ClassMaterial,
  Exam,
  ExamSubmission,
  TeacherAlert,
  TeacherPrivateClass,
  UserAccount,
  UserRole,
} from '../types/exam';
import { getSubjectMeta } from '../utils/scoring2025';
import { useSubjects } from '../utils/subjectStore';
import { localizeSubjectName, useLanguage } from '../utils/i18n';
import { NTPEXION_LOGO_PATH } from './IntroLandingPage';
import type { StudentHomeSectionId } from './StudentHomeDashboard';
import { StudentNotificationBell } from './StudentNotificationCenter';
import { TeacherNotificationBell } from './TeacherNotificationCenter';

export type AppView =
  | 'intro'
  | 'portal'
  | 'question_bank'
  | 'exam_manager'
  | 'results'
  | 'admin';

interface HeaderProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  role: UserRole;
  currentUser: UserAccount | null;
  onPrimaryAction: () => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onOpenProfile: (tab?: 'view_edit' | 'password') => void;
  onOpenAccountManager: (tab: 'create' | 'list') => void;
  onLogout: () => void;
  alerts: TeacherAlert[];
  classJoinRequests?: ClassJoinRequest[];
  alertSoundEnabled: boolean;
  onToggleAlertSound: () => void;
  onMarkAlertRead: (id: string) => void;
  onMarkAllAlertsRead: () => void;
  onClearAlerts: () => void;
  onInspectAlert: (alert: TeacherAlert) => void;
  onApproveClassJoin?: (alert: TeacherAlert) => void;
  onDismissClassJoin?: (alert: TeacherAlert) => void;
  onTriggerTestAlert: () => void;
  onOpenMobileRightSidebar: () => void;
  activePortalSection?: StudentHomeSectionId | null;
  onSelectPortalSection?: (sectionId: StudentHomeSectionId) => void;
  studentClasses?: TeacherPrivateClass[];
  studentMaterials?: ClassMaterial[];
  studentAssignments?: ClassAssignment[];
  studentExams?: Exam[];
  studentSubmissions?: ExamSubmission[];
  notificationPrefs?: NotificationPreferences;
  onOpenSupportChat?: () => void;
}

const ALL_NAV_ITEMS: {
  id: AppView;
  label: string;
  teacherOnly?: boolean;
  adminOnly?: boolean;
}[] = [
  { id: 'portal', label: 'Phòng thi' },
  { id: 'exam_manager', label: 'Tổ chức đề thi', teacherOnly: true },
  { id: 'question_bank', label: 'Ngân hàng câu hỏi', teacherOnly: true },
  { id: 'results', label: 'Kết quả thi' },
  { id: 'admin', label: 'Quản trị Admin', adminOnly: true },
];

function getAvatarInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[parts.length - 2][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function getShortGivenName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fullName;
  return parts[parts.length - 1];
}

export function Header({
  activeView,
  onNavigate,
  role,
  currentUser,
  onPrimaryAction: _onPrimaryAction,
  onOpenAuth,
  onOpenProfile,
  onOpenAccountManager,
  onLogout,
  alerts,
  classJoinRequests = [],
  alertSoundEnabled,
  onToggleAlertSound,
  onMarkAlertRead,
  onMarkAllAlertsRead,
  onClearAlerts,
  onInspectAlert,
  onApproveClassJoin,
  onDismissClassJoin,
  onTriggerTestAlert,
  onOpenMobileRightSidebar,
  activePortalSection = null,
  onSelectPortalSection,
  studentClasses = [],
  studentMaterials = [],
  studentAssignments = [],
  studentExams = [],
  studentSubmissions = [],
  notificationPrefs = {
    classNotifications: true,
    examNotifications: true,
    otherNotifications: true,
  },
  onOpenSupportChat,
}: HeaderProps) {
  useSubjects();
  const { language, t, tx } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [headerAvatarFailed, setHeaderAvatarFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const navBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [navIndicator, setNavIndicator] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    ready: boolean;
  }>({ left: 0, top: 0, width: 0, height: 0, ready: false });
  const unreadAlertsCount = alerts.filter((a) => !a.read).length;
  const isStaff = role === 'teacher' || role === 'admin';

  useEffect(() => {
    setHeaderAvatarFailed(false);
  }, [currentUser?.avatarUrl]);

  type HeaderNavEntry =
    | {
        key: string;
        label: string;
        kind: 'view';
        viewId: AppView;
        isActive: boolean;
      }
    | {
        key: string;
        label: string;
        kind: 'portal_section';
        sectionId: StudentHomeSectionId;
        isActive: boolean;
      };

  const navLabelByView: Record<AppView, string> = {
    portal: role !== 'admin' ? t.navHome : t.navPortal,
    exam_manager: t.navExamManager,
    question_bank: t.navQuestionBank,
    results: !isStaff ? t.navMyResults : t.navResults,
    intro: t.navIntro,
    admin: t.navAdmin,
  };

  const navEntries: HeaderNavEntry[] =
    role === 'teacher'
      ? [
          {
            key: 'portal',
            label: t.navHome,
            kind: 'view',
            viewId: 'portal',
            isActive:
              activeView === 'portal' &&
              activePortalSection !== 'classes' &&
              activePortalSection !== 'schedule',
          },
          {
            key: 'classes',
            label: t.navClasses,
            kind: 'portal_section',
            sectionId: 'classes',
            isActive: activeView === 'portal' && activePortalSection === 'classes',
          },
          {
            key: 'schedule',
            label: t.navSchedule,
            kind: 'portal_section',
            sectionId: 'schedule',
            isActive: activeView === 'portal' && activePortalSection === 'schedule',
          },
        ]
      : ALL_NAV_ITEMS.filter((item) => {
          if (item.adminOnly && role !== 'admin') return false;
          if (item.teacherOnly && !isStaff) return false;
          return true;
        }).map((item) => ({
          key: item.id,
          label: navLabelByView[item.id] ?? item.label,
          kind: 'view',
          viewId: item.id,
          isActive: activeView === item.id,
        }));

  const activeNavKey = navEntries.find((item) => item.isActive)?.key ?? null;

  const updateNavIndicator = useCallback(() => {
    const navEl = navRef.current;
    const activeEl = activeNavKey ? navBtnRefs.current[activeNavKey] : null;
    if (!navEl || !activeEl || activeEl.offsetWidth === 0) {
      setNavIndicator((prev) => (prev.ready ? { ...prev, ready: false } : prev));
      return;
    }
    const next = {
      left: activeEl.offsetLeft,
      top: activeEl.offsetTop,
      width: activeEl.offsetWidth,
      height: activeEl.offsetHeight,
      ready: true,
    };
    setNavIndicator((prev) =>
      prev.ready === next.ready &&
      prev.left === next.left &&
      prev.top === next.top &&
      prev.width === next.width &&
      prev.height === next.height
        ? prev
        : next,
    );
  }, [activeNavKey]);

  useLayoutEffect(() => {
    updateNavIndicator();
  }, [updateNavIndicator, language, role, navEntries.length]);

  useEffect(() => {
    const handleResize = () => updateNavIndicator();
    window.addEventListener('resize', handleResize);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && navRef.current) {
      observer = new ResizeObserver(() => updateNavIndicator());
      observer.observe(navRef.current);
    }
    return () => {
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
    };
  }, [updateNavIndicator]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(e.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountMenuOpen(false);
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [accountMenuOpen]);

  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-[#132B66] dark:bg-[#061844]/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Brand mark + single-line wordmark */}
        <button
          type="button"
          onClick={() => {
            onNavigate('portal');
            setMobileOpen(false);
          }}
          className="flex cursor-pointer items-center gap-2.5 whitespace-nowrap shrink-0 font-display text-lg font-extrabold tracking-tight text-[#061844] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0057FF] dark:text-white dark:focus-visible:outline-[#22D3EE]"
        >
          {!logoFailed && (
            <img
              src={NTPEXION_LOGO_PATH}
              alt="NTPEXION"
              referrerPolicy="no-referrer"
              onError={() => setLogoFailed(true)}
              className="h-9 w-auto rounded-md border border-slate-200/80 bg-white px-1 py-0.5 object-contain"
            />
          )}
          <span>
            NTPE<span className="text-[#0057FF] dark:text-[#00D4FF]">X</span>ION
          </span>
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          ref={navRef}
          aria-label={tx('Điều hướng chính', 'Main navigation')}
          className="relative hidden md:flex h-full items-center gap-1 lg:gap-2 text-[13px] lg:text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          {navIndicator.ready && (
            <>
              <span
                aria-hidden="true"
                style={{
                  transform: `translate3d(${navIndicator.left}px, ${navIndicator.top}px, 0)`,
                  width: `${navIndicator.width}px`,
                  height: `${navIndicator.height}px`,
                }}
                className="pointer-events-none absolute top-0 left-0 rounded-lg bg-[#0057FF]/10 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-[#22D3EE]/15"
              />
              <span
                aria-hidden="true"
                style={{
                  transform: `translate3d(${navIndicator.left}px, 0, 0)`,
                  width: `${navIndicator.width}px`,
                }}
                className="pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-gradient-to-r from-[#0057FF] to-[#06B6D4] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:from-[#0057FF] dark:to-[#22D3EE]"
              />
            </>
          )}
          {navEntries.map((item, idx) => (
            <button
              key={item.key}
              ref={(el) => {
                navBtnRefs.current[item.key] = el;
              }}
              type="button"
              title={
                item.kind === 'portal_section'
                  ? item.label
                  : `${item.label} (${tx('Phím tắt', 'Shortcut')}: ${idx + 1})`
              }
              onClick={() => {
                if (item.kind === 'portal_section') {
                  onSelectPortalSection?.(item.sectionId);
                } else {
                  onNavigate(item.viewId);
                }
              }}
              className={`relative z-10 cursor-pointer whitespace-nowrap shrink-0 rounded-lg px-3 py-1.5 transition-all duration-200 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0057FF] dark:focus-visible:outline-[#22D3EE] ${
                item.isActive
                  ? 'font-semibold text-[#0057FF] dark:text-[#22D3EE]'
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-[#061844] dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Alerts Bell + Account + Sidebar Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {isStaff ? (
            <TeacherNotificationBell
              alerts={alerts}
              classJoinRequests={classJoinRequests}
              soundEnabled={alertSoundEnabled}
              onToggleSound={onToggleAlertSound}
              onMarkRead={onMarkAlertRead}
              onMarkAllRead={onMarkAllAlertsRead}
              onClearAll={onClearAlerts}
              onInspectAlert={onInspectAlert}
              onApproveClassJoin={onApproveClassJoin}
              onDismissClassJoin={onDismissClassJoin}
              onTriggerTestAlert={onTriggerTestAlert}
            />
          ) : (
            <StudentNotificationBell
              currentUser={currentUser}
              privateClasses={studentClasses}
              classJoinRequests={classJoinRequests}
              classMaterials={studentMaterials}
              classAssignments={studentAssignments}
              exams={studentExams}
              submissions={studentSubmissions}
              notificationPrefs={notificationPrefs}
              onSelectPortalSection={onSelectPortalSection}
              onOpenSupportChat={onOpenSupportChat}
            />
          )}

          {currentUser ? (
            <div ref={accountMenuRef} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                title={`${currentUser.fullName} · ${currentUser.id}`}
                onClick={() => setAccountMenuOpen((v) => !v)}
                className={`inline-flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full pr-2.5 pl-0 text-xs font-semibold text-blue-600 transition-all duration-200 active:scale-[0.97] dark:text-blue-400 ${
                  accountMenuOpen
                    ? 'bg-blue-50 ring-2 ring-[#0057FF]/30 dark:bg-slate-700 dark:ring-[#22D3EE]/35'
                    : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700'
                }`}
              >
                {currentUser.avatarUrl && !headerAvatarFailed ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.fullName}
                    referrerPolicy="no-referrer"
                    onError={() => setHeaderAvatarFailed(true)}
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-400 text-[11px] font-bold tracking-tight text-white dark:bg-slate-600">
                    {getAvatarInitials(currentUser.fullName)}
                  </span>
                )}
                <svg
                  viewBox="0 0 16 18"
                  aria-hidden="true"
                  className={`h-3.5 w-3.5 shrink-0 ${
                    currentUser.role === 'admin'
                      ? 'text-red-500 dark:text-red-400'
                      : currentUser.role === 'teacher'
                        ? 'text-emerald-500 dark:text-emerald-400'
                        : 'text-blue-600 dark:text-blue-400'
                  }`}
                >
                  <path
                    d="M8 0.8L1.5 3.4V8.3C1.5 12.6 4.27 16.45 8 17.6C11.73 16.45 14.5 12.6 14.5 8.3V3.4L8 0.8Z"
                    fill="currentColor"
                  />
                  <path
                    d="M8 5.4L8.75 7.45L10.8 8.2L8.75 8.95L8 11L7.25 8.95L5.2 8.2L7.25 7.45L8 5.4Z"
                    fill="#FFFFFF"
                  />
                </svg>
                <span className="max-w-[78px] truncate text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {getShortGivenName(currentUser.fullName)}
                </span>
                <svg
                  viewBox="0 0 10 6"
                  aria-hidden="true"
                  className={`h-1.5 w-2 shrink-0 text-slate-600 transition-transform duration-200 dark:text-slate-300 ${
                    accountMenuOpen ? 'rotate-180' : ''
                  }`}
                >
                  <polygon points="0,0 10,0 5,6" fill="currentColor" />
                </svg>
              </button>

              <div
                role="menu"
                aria-hidden={!accountMenuOpen}
                className={`absolute right-0 mt-2 w-80 origin-top-right overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] dark:border-slate-700 dark:bg-slate-900 ${
                  accountMenuOpen
                    ? 'visible translate-y-0 scale-100 opacity-100'
                    : 'pointer-events-none invisible -translate-y-2 scale-95 opacity-0'
                }`}
              >
                  <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                    <div className="flex items-center gap-3">
                      {currentUser.avatarUrl && !headerAvatarFailed ? (
                        <img
                          src={currentUser.avatarUrl}
                          alt={currentUser.fullName}
                          referrerPolicy="no-referrer"
                          onError={() => setHeaderAvatarFailed(true)}
                          className="h-10 w-10 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 font-display text-xs font-bold text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300">
                          {currentUser.fullName.trim().slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                            {currentUser.fullName}
                          </p>
                          <span className="shrink-0 font-mono text-[11px] font-bold text-slate-600 tabular-nums dark:text-slate-300">
                            ID: {currentUser.id}
                          </span>
                        </div>
                        <p className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {currentUser.email}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] font-medium text-blue-700 dark:text-blue-400">
                      {currentUser.role === 'admin'
                        ? `${tx('Quản trị viên hệ thống', 'System Administrator')}${currentUser.schoolName ? ` · ${currentUser.schoolName}` : ''}${currentUser.phone ? ` · ${tx('SĐT', 'Phone')}: ${currentUser.phone}` : ''}`
                        : currentUser.role === 'teacher'
                          ? `${tx('Giáo viên', 'Teacher')} · ${localizeSubjectName(currentUser.subject ?? 'toan', getSubjectMeta(currentUser.subject ?? 'toan').name, language)}${currentUser.schoolName ? ` · ${currentUser.schoolName}` : ''}${currentUser.phone ? ` · ${tx('SĐT', 'Phone')}: ${currentUser.phone}` : ''}`
                          : `${tx('Học sinh', 'Student')} · ${tx('SBD', 'ID')} ${currentUser.studentSbd ?? '—'}${currentUser.phone ? ` · ${tx('SĐT', 'Phone')}: ${currentUser.phone}` : ''}`}
                    </p>
                    {currentUser.facebookUrl && (
                      <a
                        href={currentUser.facebookUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex max-w-full items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-400"
                      >
                        <span className="truncate">{currentUser.facebookUrl}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    )}
                  </div>

                  <div className="p-1.5 text-xs">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onOpenProfile('view_edit');
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left font-semibold text-slate-800 hover:bg-blue-50/70 hover:text-blue-700 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-blue-300"
                    >
                      <Pencil className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                      <span>{t.menuProfileInfo}</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onOpenProfile('password');
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <KeyRound className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      <span>{t.menuChangePassword}</span>
                    </button>
                    <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                    {currentUser.role === 'admin' && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          onNavigate('admin');
                        }}
                        className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left font-semibold text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
                      >
                        <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <span>{t.menuAdminPage}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onOpenAccountManager('create');
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <UserPlus className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                      <span>
                        {currentUser.role === 'admin'
                          ? t.menuCreateAccountAdmin
                          : t.menuCreateAccountStaff}
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onOpenAccountManager('list');
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Users className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      <span>{t.menuAccountList}</span>
                    </button>
                    <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onLogout();
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>{t.menuLogout}</span>
                    </button>
                  </div>
                </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>{t.authLoginRegister}</span>
            </button>
          )}

          <button
            type="button"
            aria-label={tx('Mở cột menu bên phải', 'Open right menu')}
            onClick={onOpenMobileRightSidebar}
            className="inline-flex h-9 w-9 md:hidden cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>

          <button
            type="button"
            aria-label={
              mobileOpen ? tx('Đóng menu', 'Close menu') : tx('Mở menu', 'Open menu')
            }
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex md:hidden cursor-pointer items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden dark:border-[#132B66] dark:bg-[#061844]">
          <div className="flex flex-col gap-1">
            {currentUser && (
              <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="flex items-center gap-2.5">
                  {currentUser.avatarUrl && !headerAvatarFailed ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.fullName}
                      referrerPolicy="no-referrer"
                      onError={() => setHeaderAvatarFailed(true)}
                      className="h-9 w-9 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700"
                    />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 font-display text-xs font-bold text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300">
                      {currentUser.fullName.trim().slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                        {currentUser.fullName}
                      </p>
                      <span className="shrink-0 font-mono text-[11px] font-bold text-slate-600 tabular-nums dark:text-slate-300">
                        ID: {currentUser.id}
                      </span>
                    </div>
                    <p className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {currentUser.email}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenProfile('view_edit');
                      setMobileOpen(false);
                    }}
                    className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <Pencil className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" />
                    <span>{t.menuProfileInfoShort}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenProfile('password');
                      setMobileOpen(false);
                    }}
                    className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>{t.menuChangePasswordMobile}</span>
                  </button>
                </div>
              </div>
            )}
            {navEntries.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  if (item.kind === 'portal_section') {
                    onSelectPortalSection?.(item.sectionId);
                  } else {
                    onNavigate(item.viewId);
                  }
                  setMobileOpen(false);
                }}
                className={`w-full cursor-pointer rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  item.isActive
                    ? 'bg-[#0057FF]/10 font-semibold text-[#0057FF] dark:bg-[#0B225B] dark:text-[#22D3EE]'
                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#0B225B]/60'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
