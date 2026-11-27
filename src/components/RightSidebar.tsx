import {
  Award,
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Compass,
  Database,
  FileSpreadsheet,
  GraduationCap,
  KeyRound,
  LogOut,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useState, type ComponentType } from 'react';
import type { UserAccount, UserRole } from '../types/exam';
import { useLanguage } from '../utils/i18n';
import type { AppView } from './Header';
import type { StudentHomeSectionId } from './StudentHomeDashboard';
import type { TeacherClassRoomTab } from './TeacherHomeDashboard';

interface RightSidebarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  role: UserRole;
  currentUser: UserAccount | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onOpenProfile: (tab?: 'view_edit' | 'password') => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  unreadAlertsCount: number;
  pendingJoinRequestsCount?: number;
  activeStudentSection?: StudentHomeSectionId | null;
  onSelectStudentSection?: (sectionId: StudentHomeSectionId) => void;
  activeTeacherClass?: { id: string; name: string; code: string } | null;
  activeTeacherClassTab?: TeacherClassRoomTab | null;
  activeTeacherClassPendingCount?: number;
  onSelectTeacherClassTab?: (tab: TeacherClassRoomTab) => void;
  onOpenTeacherClassEdit?: () => void;
  onExitTeacherClass?: () => void;
}

interface SidebarNavItem {
  id: AppView;
  label: string;
  shortHint: string;
  icon: ComponentType<{ className?: string }>;
  teacherOnly?: boolean;
  adminOnly?: boolean;
}

const SIDEBAR_ITEMS: SidebarNavItem[] = [
  { id: 'portal', label: 'Phòng thi', shortHint: '1', icon: Compass },
  {
    id: 'exam_manager',
    label: 'Tổ chức đề thi',
    shortHint: '2',
    icon: FileSpreadsheet,
    teacherOnly: true,
  },
  {
    id: 'question_bank',
    label: 'Ngân hàng câu hỏi',
    shortHint: '3',
    icon: Database,
    teacherOnly: true,
  },
  { id: 'results', label: 'Kết quả thi', shortHint: '4', icon: BarChart3 },
  {
    id: 'admin',
    label: 'Quản trị Admin',
    shortHint: '5',
    icon: ShieldCheck,
    adminOnly: true,
  },
];

const STUDENT_SECTION_ITEMS: {
  id: StudentHomeSectionId;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { id: 'classes', label: 'Lớp học', icon: GraduationCap },
  { id: 'schedule', label: 'Lịch học', icon: CalendarDays },
  { id: 'materials', label: 'Tài liệu', icon: BookOpen },
  { id: 'assignments', label: 'Bài tập', icon: ClipboardList },
  { id: 'exams', label: 'Bài thi', icon: KeyRound },
  { id: 'scores', label: 'Bảng điểm', icon: Award },
];

export function RightSidebar({
  activeView,
  onNavigate,
  role,
  currentUser,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  onOpenAuth: _onOpenAuth,
  onOpenProfile: _onOpenProfile,
  onOpenSettings,
  onLogout,
  unreadAlertsCount,
  pendingJoinRequestsCount = 0,
  activeStudentSection,
  onSelectStudentSection,
  activeTeacherClass = null,
  activeTeacherClassTab = null,
  activeTeacherClassPendingCount = 0,
  onSelectTeacherClassTab,
  onOpenTeacherClassEdit,
  onExitTeacherClass,
}: RightSidebarProps) {
  const { t, tx } = useLanguage();

  const isStaff = role === 'teacher' || role === 'admin';
  const isInTeacherClass =
    role === 'teacher' && activeView === 'portal' && Boolean(activeTeacherClass);

  const navLabelByView: Record<AppView, string> = {
    portal: role !== 'admin' ? t.navHome : t.navPortal,
    exam_manager: t.navExamManager,
    question_bank: t.navQuestionBank,
    results: !isStaff ? t.navMyResults : t.navResults,
    admin: t.navAdmin,
    intro: t.navIntroFull,
  };

  const sectionLabelById: Record<StudentHomeSectionId, string> = {
    classes: t.navClasses,
    schedule: t.navSchedule,
    materials: t.navMaterials,
    assignments: t.navAssignments,
    exams: t.navExams,
    scores: t.navScores,
  };

  const visibleItems = SIDEBAR_ITEMS.filter((item) => {
    if (item.adminOnly && role !== 'admin') return false;
    if (item.teacherOnly && !isStaff) return false;
    if (
      role === 'teacher' &&
      (item.id === 'exam_manager' ||
        item.id === 'question_bank' ||
        item.id === 'results')
    ) {
      return false;
    }
    return true;
  }).map((item) => ({
    ...item,
    label: navLabelByView[item.id] ?? item.label,
  }));

  const teacherTeachingViews = SIDEBAR_ITEMS.filter(
    (item) =>
      item.id === 'exam_manager' ||
      item.id === 'question_bank' ||
      item.id === 'results',
  ).map((item) => ({
    ...item,
    label: navLabelByView[item.id] ?? item.label,
  }));

  const renderSidebarBody = (isCompact: boolean, isMobileDrawer: boolean) => (
    <div className="flex h-full flex-col justify-between overflow-hidden">
      {/* Top section: Header + Nav items */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {isCompact ? (
          <div className="flex justify-center pb-1">
            {isMobileDrawer ? (
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label={tx('Đóng cột menu bên phải', 'Close right menu')}
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label={tx('Mở rộng cột menu bên phải', 'Expand right sidebar')}
                title={tx('Mở rộng cột menu (M)', 'Expand sidebar (M)')}
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white dark:focus-visible:outline-blue-400"
              >
                <PanelRightOpen className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : null}

        {/* Navigation Links: Teacher Classroom 7-item Menu vs Default Navigation */}
        {isInTeacherClass && activeTeacherClass ? (
          <nav
            aria-label={tx('Menu trong lớp học giáo viên', 'Teacher class menu')}
            className="space-y-1"
          >
            {!isCompact && (
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <span className="truncate text-[11px] font-semibold tracking-wider text-slate-400 uppercase dark:text-slate-500">
                  {t.sidebarClassMenuHeading}
                </span>
                {isMobileDrawer ? (
                  <button
                    type="button"
                    onClick={onCloseMobile}
                    aria-label={tx('Đóng cột menu bên phải', 'Close right menu')}
                    className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onToggleCollapse}
                    aria-label={tx('Thu gọn cột menu bên phải', 'Collapse right sidebar')}
                    title={tx('Thu gọn cột menu (M)', 'Collapse sidebar (M)')}
                    className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white dark:focus-visible:outline-blue-400"
                  >
                    <PanelRightClose className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
            {!isCompact && (
              <div
                role="button"
                tabIndex={0}
                title={tx('Chỉnh sửa thông tin lớp học', 'Edit class details')}
                onClick={() => {
                  onOpenTeacherClassEdit?.();
                  if (isMobileDrawer) onCloseMobile();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenTeacherClassEdit?.();
                    if (isMobileDrawer) onCloseMobile();
                  }
                }}
                className="mb-2 cursor-pointer rounded-lg border border-blue-200/80 bg-blue-50/50 px-2.5 py-2 transition-colors hover:border-blue-300 hover:bg-blue-100/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:hover:border-blue-800 dark:hover:bg-blue-950/50 dark:focus-visible:outline-blue-400"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-bold text-[#061844] dark:text-slate-100">
                    {activeTeacherClass.name}
                  </p>
                  <Pencil className="h-3 w-3 shrink-0 text-[#0057FF] dark:text-[#22D3EE]" />
                </div>
                <p className="mt-0.5 font-mono text-[11px] font-semibold text-[#0057FF] tabular-nums dark:text-[#22D3EE]">
                  {tx('Mã lớp', 'Class code')}: {activeTeacherClass.code}
                </p>
              </div>
            )}
            {(
              [
                {
                  key: 'home',
                  label: t.navHome,
                  icon: Compass,
                  isActive: false,
                  onClick: () => {
                    onExitTeacherClass?.();
                    onNavigate('portal');
                  },
                },
                {
                  key: 'overview',
                  label: tx('Tổng quan lớp học', 'Class Overview'),
                  icon: GraduationCap,
                  isActive: activeTeacherClassTab === 'overview',
                  onClick: () => onSelectTeacherClassTab?.('overview'),
                },
                {
                  key: 'students',
                  label: tx('Thành viên', 'Members'),
                  icon: Users,
                  isActive: activeTeacherClassTab === 'students',
                  badge:
                    activeTeacherClassPendingCount > 0
                      ? activeTeacherClassPendingCount
                      : undefined,
                  onClick: () => onSelectTeacherClassTab?.('students'),
                },
                {
                  key: 'assignments',
                  label: t.navAssignments,
                  icon: ClipboardList,
                  isActive: activeTeacherClassTab === 'assignments',
                  onClick: () => onSelectTeacherClassTab?.('assignments'),
                },
                {
                  key: 'exams',
                  label: t.navExams,
                  icon: KeyRound,
                  isActive: activeTeacherClassTab === 'exams',
                  onClick: () => onSelectTeacherClassTab?.('exams'),
                },
                {
                  key: 'scores',
                  label: t.navResults,
                  icon: BarChart3,
                  isActive: activeTeacherClassTab === 'scores',
                  onClick: () => onSelectTeacherClassTab?.('scores'),
                },
                {
                  key: 'schedule',
                  label: t.navSchedule,
                  icon: CalendarDays,
                  isActive: activeTeacherClassTab === 'schedule',
                  onClick: () => onSelectTeacherClassTab?.('schedule'),
                },
              ] as {
                key: string;
                label: string;
                icon: ComponentType<{ className?: string }>;
                isActive: boolean;
                badge?: number;
                onClick: () => void;
              }[]
            ).map((entry) => {
              const Icon = entry.icon;
              return (
                <button
                  key={entry.key}
                  type="button"
                  title={entry.label}
                  aria-current={entry.isActive ? 'page' : undefined}
                  onClick={() => {
                    entry.onClick();
                    if (isMobileDrawer) onCloseMobile();
                  }}
                  className={`group flex cursor-pointer items-center rounded-lg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:focus-visible:outline-blue-400 ${
                    isCompact
                      ? 'mx-auto h-10 w-10 justify-center'
                      : 'w-full justify-between gap-2.5 px-2.5 py-2'
                  } ${
                    entry.isActive
                      ? 'bg-blue-50/90 font-semibold text-blue-700 ring-1 ring-inset ring-blue-200/70 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-800/60'
                      : 'font-medium text-slate-700 hover:bg-slate-100/90 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        entry.isActive
                          ? 'text-blue-700 dark:text-blue-400'
                          : 'text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200'
                      }`}
                    />
                    {!isCompact && (
                      <span className="truncate text-[13px] leading-5">{entry.label}</span>
                    )}
                  </span>
                  {!isCompact && entry.badge !== undefined && (
                    <span className="font-mono text-[11px] font-bold text-amber-600 tabular-nums dark:text-amber-400">
                      {entry.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        ) : (
          <>
            <nav aria-label={tx('Menu chức năng bên phải', 'Right navigation menu')} className="space-y-1">
              {!isCompact && (
                <div className="mb-1 flex items-center justify-end">
                  {isMobileDrawer ? (
                    <button
                      type="button"
                      onClick={onCloseMobile}
                      aria-label={tx('Đóng cột menu bên phải', 'Close right menu')}
                      className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onToggleCollapse}
                      aria-label={tx('Thu gọn cột menu bên phải', 'Collapse right sidebar')}
                      title={tx('Thu gọn cột menu (M)', 'Collapse sidebar (M)')}
                      className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white dark:focus-visible:outline-blue-400"
                    >
                      <PanelRightClose className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  activeView === item.id &&
                  !(
                    (role === 'student' || role === 'teacher') &&
                    item.id === 'portal' &&
                    activeStudentSection
                  );
                const showAlertCount = isStaff && item.id === 'results' && unreadAlertsCount > 0;

                return (
                  <button
                    key={item.id}
                    type="button"
                    title={
                      isCompact
                        ? `${item.label} (${tx('Phím', 'Key')} ${item.shortHint})`
                        : `${tx('Phím tắt', 'Shortcut')}: ${item.shortHint}`
                    }
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => {
                      onNavigate(item.id);
                      if (isMobileDrawer) onCloseMobile();
                    }}
                    className={`group flex cursor-pointer items-center rounded-lg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:focus-visible:outline-blue-400 ${
                      isCompact
                        ? 'mx-auto h-10 w-10 justify-center'
                        : 'w-full justify-between gap-2.5 px-2.5 py-2'
                    } ${
                      isActive
                        ? 'bg-blue-50/90 font-semibold text-blue-700 ring-1 ring-inset ring-blue-200/70 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-800/60'
                        : 'font-medium text-slate-700 hover:bg-slate-100/90 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-blue-700 dark:text-blue-400'
                            : 'text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200'
                        }`}
                      />
                      {!isCompact && (
                        <span className="truncate text-[13px] leading-5">{item.label}</span>
                      )}
                    </span>

                    {!isCompact && (
                      <span className="flex shrink-0 items-center gap-1.5">
                        {showAlertCount && (
                          <span className="font-mono text-[11px] font-bold text-red-600 tabular-nums dark:text-red-400">
                            {unreadAlertsCount}
                          </span>
                        )}
                        <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-slate-200/90 bg-slate-50 px-1 font-mono text-[10px] font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400">
                          {item.shortHint}
                        </kbd>
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Portal Sections (Student & Teacher outside class) */}
            {(role === 'student' || role === 'teacher') && onSelectStudentSection && (
              <>
                <div className="mx-1 h-px bg-slate-200/80 dark:bg-slate-800" />
                <nav
                  aria-label={
                    role === 'teacher' ? t.sidebarTeacherSectionHeading : t.sidebarStudentSectionHeading
                  }
                  className="space-y-1"
                >
                  {STUDENT_SECTION_ITEMS.filter((sec) =>
                    role === 'teacher'
                      ? sec.id === 'classes' || sec.id === 'schedule'
                      : true,
                  ).map((sec) => {
                    const Icon = sec.icon;
                    const secLabel = sectionLabelById[sec.id] ?? sec.label;
                    const isActive =
                      activeView === 'portal' && activeStudentSection === sec.id;
                    const showPending =
                      role === 'teacher' &&
                      sec.id === 'classes' &&
                      pendingJoinRequestsCount > 0;

                    return (
                      <button
                        key={sec.id}
                        type="button"
                        title={secLabel}
                        onClick={() => {
                          onSelectStudentSection(sec.id);
                          if (isMobileDrawer) onCloseMobile();
                        }}
                        className={`group flex cursor-pointer items-center rounded-lg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:focus-visible:outline-blue-400 ${
                          isCompact
                            ? 'mx-auto h-10 w-10 justify-center'
                            : 'w-full justify-between gap-2.5 px-2.5 py-2'
                        } ${
                          isActive
                            ? 'bg-blue-50/90 font-semibold text-blue-700 ring-1 ring-inset ring-blue-200/70 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-800/60'
                            : 'font-medium text-slate-700 hover:bg-slate-100/90 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Icon
                            className={`h-4 w-4 shrink-0 transition-colors ${
                              isActive
                                ? 'text-blue-700 dark:text-blue-400'
                                : 'text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200'
                            }`}
                          />
                          {!isCompact && (
                            <span className="truncate text-[13px] leading-5">{secLabel}</span>
                          )}
                        </span>
                        {!isCompact && showPending && (
                          <span className="font-mono text-[11px] font-bold text-amber-600 tabular-nums dark:text-amber-400">
                            {pendingJoinRequestsCount}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {role === 'teacher' &&
                    teacherTeachingViews.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeView === item.id;
                      const showAlertCount = item.id === 'results' && unreadAlertsCount > 0;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          title={
                            isCompact
                              ? `${item.label} (${tx('Phím', 'Key')} ${item.shortHint})`
                              : `${tx('Phím tắt', 'Shortcut')}: ${item.shortHint}`
                          }
                          aria-current={isActive ? 'page' : undefined}
                          onClick={() => {
                            onNavigate(item.id);
                            if (isMobileDrawer) onCloseMobile();
                          }}
                          className={`group flex cursor-pointer items-center rounded-lg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:focus-visible:outline-blue-400 ${
                            isCompact
                              ? 'mx-auto h-10 w-10 justify-center'
                              : 'w-full justify-between gap-2.5 px-2.5 py-2'
                          } ${
                            isActive
                              ? 'bg-blue-50/90 font-semibold text-blue-700 ring-1 ring-inset ring-blue-200/70 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-800/60'
                              : 'font-medium text-slate-700 hover:bg-slate-100/90 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white'
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <Icon
                              className={`h-4 w-4 shrink-0 transition-colors ${
                                isActive
                                  ? 'text-blue-700 dark:text-blue-400'
                                  : 'text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200'
                              }`}
                            />
                            {!isCompact && (
                              <span className="truncate text-[13px] leading-5">{item.label}</span>
                            )}
                          </span>
                          {!isCompact && (
                            <span className="flex shrink-0 items-center gap-1.5">
                              {showAlertCount && (
                                <span className="font-mono text-[11px] font-bold text-red-600 tabular-nums dark:text-red-400">
                                  {unreadAlertsCount}
                                </span>
                              )}
                              <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-slate-200/90 bg-slate-50 px-1 font-mono text-[10px] font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400">
                                {item.shortHint}
                              </kbd>
                            </span>
                          )}
                        </button>
                      );
                    })}
                </nav>
              </>
            )}
          </>
        )}

        <div className="mx-1 h-px bg-slate-200/80 dark:bg-slate-800" />

        {/* Quick Actions & Utilities */}
        <div className="space-y-1">
          {!isCompact && (
            <p className="mb-1.5 px-2.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase dark:text-slate-500">
              {t.sidebarUtilitiesHeading}
            </p>
          )}

          <button
            type="button"
            title={t.settingsTitle}
            onClick={() => {
              onOpenSettings();
              if (isMobileDrawer) onCloseMobile();
            }}
            className={`group flex cursor-pointer items-center rounded-lg font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-100/90 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white dark:focus-visible:outline-blue-400 ${
              isCompact
                ? 'mx-auto h-10 w-10 justify-center'
                : 'w-full gap-2.5 px-2.5 py-2'
            }`}
          >
            <Settings className="h-4 w-4 shrink-0 text-slate-500 transition-colors group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200" />
            {!isCompact && (
              <span className="truncate text-[13px] leading-5">{t.sidebarSettingsLabel}</span>
            )}
          </button>
        </div>
      </div>

      {/* Bottom Session Footer */}
      {currentUser && (
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          {isCompact ? (
            <div className="flex justify-center">
              <button
                type="button"
                title={`${t.menuLogout} (${currentUser.fullName})`}
                onClick={onLogout}
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-red-600 transition-colors hover:bg-red-50 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                onLogout();
                if (isMobileDrawer) onCloseMobile();
              }}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{t.menuLogout}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop persistent right-hand collapsible sidebar */}
      <aside
        aria-label={tx('Thanh menu bên phải', 'Right sidebar')}
        className={`no-print hidden shrink-0 border-l border-slate-200 bg-white transition-[width] duration-150 ease-out md:sticky md:top-16 md:block md:h-[calc(100vh-4rem)] dark:border-slate-800 dark:bg-slate-900 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {renderSidebarBody(collapsed, false)}
      </aside>

      {/* Mobile slide-over right drawer */}
      {mobileOpen && (
        <div
          className="no-print fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs md:hidden dark:bg-slate-950/75"
          onClick={onCloseMobile}
        >
          <aside
            aria-label={tx('Thanh menu bên phải trên di động', 'Mobile right sidebar')}
            className="h-full w-72 border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {renderSidebarBody(false, true)}
          </aside>
        </div>
      )}
    </>
  );
}
