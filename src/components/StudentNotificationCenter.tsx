import {
  Bell,
  BookOpen,
  CheckCheck,
  ClipboardList,
  Clock,
  ExternalLink,
  FileText,
  Headphones,
  Trash2,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { NotificationPreferences } from '../hooks/useNotificationPreferences';
import type {
  ClassAssignment,
  ClassJoinRequest,
  ClassMaterial,
  Exam,
  ExamSubmission,
  TeacherPrivateClass,
  UserAccount,
} from '../types/exam';
import { localizeSubjectName, useLanguage } from '../utils/i18n';
import { formatRelativeTimeVi, useRealtimeNow } from '../utils/realtimeClient';
import { getSubjectMeta } from '../utils/scoring2025';
import { getSupportThreadIdForUser, useSupportChats } from '../utils/supportChatStore';
import { useSubjects } from '../utils/subjectStore';
import type { StudentHomeSectionId } from './StudentHomeDashboard';

const STUDENT_NOTIF_STORAGE_PREFIX = 'kythi2025_student_notif_state_v1_';

interface StudentNotifStorageState {
  readIds: string[];
  clearedAtMs: number;
}

function readStudentNotifState(userKey: string): StudentNotifStorageState {
  if (typeof window === 'undefined') return { readIds: [], clearedAtMs: 0 };
  try {
    const raw = localStorage.getItem(`${STUDENT_NOTIF_STORAGE_PREFIX}${userKey}`);
    if (!raw) return { readIds: [], clearedAtMs: 0 };
    const parsed = JSON.parse(raw) as Partial<StudentNotifStorageState>;
    return {
      readIds: Array.isArray(parsed.readIds)
        ? parsed.readIds.filter((id): id is string => typeof id === 'string')
        : [],
      clearedAtMs: typeof parsed.clearedAtMs === 'number' ? parsed.clearedAtMs : 0,
    };
  } catch {
    return { readIds: [], clearedAtMs: 0 };
  }
}

function writeStudentNotifState(
  userKey: string,
  state: StudentNotifStorageState,
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      `${STUDENT_NOTIF_STORAGE_PREFIX}${userKey}`,
      JSON.stringify({
        readIds: state.readIds.slice(-200),
        clearedAtMs: state.clearedAtMs,
      }),
    );
  } catch {
    // Ignore storage errors
  }
}

export interface StudentNotificationItem {
  id: string;
  kind: 'class_join' | 'assignment' | 'material' | 'exam' | 'support';
  title: string;
  subtitle: string;
  detail: string;
  timestamp: string;
  targetSection?: StudentHomeSectionId;
  actionLabel: string;
  tone: 'emerald' | 'amber' | 'red' | 'blue';
}

interface StudentNotificationBellProps {
  currentUser: UserAccount | null;
  privateClasses: TeacherPrivateClass[];
  classJoinRequests: ClassJoinRequest[];
  classMaterials: ClassMaterial[];
  classAssignments: ClassAssignment[];
  exams: Exam[];
  submissions: ExamSubmission[];
  notificationPrefs: NotificationPreferences;
  onSelectPortalSection?: (sectionId: StudentHomeSectionId) => void;
  onOpenSupportChat?: () => void;
}

export function StudentNotificationBell({
  currentUser,
  privateClasses,
  classJoinRequests,
  classMaterials,
  classAssignments,
  exams,
  submissions,
  notificationPrefs,
  onSelectPortalSection,
  onOpenSupportChat,
}: StudentNotificationBellProps) {
  useSubjects();
  const { language, tx } = useLanguage();
  const supportThreads = useSupportChats();
  const realtimeNow = useRealtimeNow(10_000);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const userKey = currentUser?.id ?? 'guest_student';
  const [notifState, setNotifState] = useState<StudentNotifStorageState>(() =>
    readStudentNotifState(userKey),
  );

  useEffect(() => {
    setNotifState(readStudentNotifState(userKey));
  }, [userKey]);

  const updateNotifState = (
    updater: (prev: StudentNotifStorageState) => StudentNotifStorageState,
  ) => {
    setNotifState((prev) => {
      const next = updater(prev);
      writeStudentNotifState(userKey, next);
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const classMap = useMemo(
    () => new Map(privateClasses.map((pc) => [pc.id, pc])),
    [privateClasses],
  );

  const enrolledClassIds = useMemo(() => {
    const ids = new Set<string>(currentUser?.enrolledClassIds ?? []);
    for (const req of classJoinRequests) {
      if (req.studentUserId === userKey && req.status === 'approved') {
        ids.add(req.classId);
      }
    }
    return ids;
  }, [classJoinRequests, currentUser?.enrolledClassIds, userKey]);

  const submittedExamIds = useMemo(
    () => new Set(submissions.map((s) => s.examId)),
    [submissions],
  );

  const notifications = useMemo<StudentNotificationItem[]>(() => {
    const items: StudentNotificationItem[] = [];

    if (notificationPrefs.classNotifications) {
      for (const req of classJoinRequests) {
        if (req.studentUserId !== userKey) continue;
        const cls = classMap.get(req.classId);
        const classLabel = cls?.name ?? req.classCode;
        const ts = req.reviewedAt ?? req.requestedAt;

        if (req.status === 'approved') {
          items.push({
            id: `join_approved_${req.id}_${ts}`,
            kind: 'class_join',
            title: tx('Đã duyệt vào lớp học', 'Class join approved'),
            subtitle: `${classLabel} · ${req.classCode}`,
            detail: req.reviewedByTeacherName
              ? tx(
                  `${req.reviewedByTeacherName} đã duyệt yêu cầu tham gia lớp học của bạn.`,
                  `${req.reviewedByTeacherName} approved your class join request.`,
                )
              : tx(
                  'Bạn đã được duyệt tham gia lớp học này.',
                  'Your request to join this class was approved.',
                ),
            timestamp: ts,
            targetSection: 'classes',
            actionLabel: tx('Mở lớp học', 'Open class'),
            tone: 'emerald',
          });
        } else if (req.status === 'rejected') {
          items.push({
            id: `join_rejected_${req.id}_${ts}`,
            kind: 'class_join',
            title: tx('Yêu cầu vào lớp chưa được duyệt', 'Class join declined'),
            subtitle: `${classLabel} · ${req.classCode}`,
            detail: tx(
              'Giáo viên chưa duyệt yêu cầu tham gia lớp. Bạn có thể kiểm tra lại mã lớp.',
              'Your join request was declined. Please check the class code with your teacher.',
            ),
            timestamp: ts,
            targetSection: 'classes',
            actionLabel: tx('Xem lớp học', 'View classes'),
            tone: 'red',
          });
        } else {
          items.push({
            id: `join_pending_${req.id}`,
            kind: 'class_join',
            title: tx('Đang chờ duyệt vào lớp', 'Join request pending'),
            subtitle: `${classLabel} · ${req.classCode}`,
            detail: tx(
              'Yêu cầu tham gia lớp học của bạn đã được gửi tới giáo viên.',
              'Your class join request has been sent to the teacher.',
            ),
            timestamp: req.requestedAt,
            targetSection: 'classes',
            actionLabel: tx('Xem trạng thái', 'View status'),
            tone: 'amber',
          });
        }
      }

      for (const asg of classAssignments) {
        if (!enrolledClassIds.has(asg.classId)) continue;
        const cls = classMap.get(asg.classId);
        const subjName = localizeSubjectName(
          asg.subject,
          getSubjectMeta(asg.subject).name,
          language,
        );
        items.push({
          id: `assignment_${asg.id}`,
          kind: 'assignment',
          title: tx('Bài tập lớp mới', 'New class assignment'),
          subtitle: `${asg.title} · ${cls?.name ?? subjName}`,
          detail: tx(
            `Môn ${subjName} · Hạn: ${asg.dueDateLabel} · GV ${asg.ownerTeacherName}`,
            `${subjName} · Due: ${asg.dueDateLabel} · ${asg.ownerTeacherName}`,
          ),
          timestamp: asg.createdAt,
          targetSection: 'assignments',
          actionLabel: tx('Làm bài tập', 'Open assignment'),
          tone: 'blue',
        });
      }

      for (const mat of classMaterials) {
        if (!enrolledClassIds.has(mat.classId)) continue;
        const cls = classMap.get(mat.classId);
        const subjName = localizeSubjectName(
          mat.subject,
          getSubjectMeta(mat.subject).name,
          language,
        );
        items.push({
          id: `material_${mat.id}`,
          kind: 'material',
          title: tx('Tài liệu học tập mới', 'New study material'),
          subtitle: `${mat.title} · ${cls?.name ?? subjName}`,
          detail: tx(
            `${mat.category} · Môn ${subjName} · GV ${mat.ownerTeacherName}`,
            `${mat.category} · ${subjName} · ${mat.ownerTeacherName}`,
          ),
          timestamp: mat.createdAt,
          targetSection: 'materials',
          actionLabel: tx('Xem tài liệu', 'View material'),
          tone: 'blue',
        });
      }
    }

    if (notificationPrefs.examNotifications) {
      for (const exam of exams) {
        if (exam.status !== 'active') continue;
        const subjName = localizeSubjectName(
          exam.subject,
          getSubjectMeta(exam.subject).name,
          language,
        );
        const alreadySubmitted = submittedExamIds.has(exam.id);
        items.push({
          id: `exam_${exam.id}`,
          kind: 'exam',
          title: alreadySubmitted
            ? tx('Kỳ thi đang mở (Đã nộp bài)', 'Active exam (Submitted)')
            : tx('Phòng thi đang mở', 'Active exam room'),
          subtitle: `${exam.title} · ${exam.roomCode}`,
          detail: tx(
            `Môn ${subjName} · Thời gian ${exam.duration} phút`,
            `${subjName} · Duration ${exam.duration} mins`,
          ),
          timestamp: exam.createdAt,
          targetSection: 'exams',
          actionLabel: tx('Vào phòng thi', 'Go to exams'),
          tone: alreadySubmitted ? 'emerald' : 'amber',
        });
      }
    }

    if (notificationPrefs.otherNotifications) {
      const threadId = getSupportThreadIdForUser(currentUser);
      const thread = supportThreads.find((t) => t.id === threadId);
      if (thread && (thread.unreadForUser || 0) > 0) {
        const latestAdminMsg = [...thread.messages]
          .reverse()
          .find((m) => m.senderRole === 'admin');
        if (latestAdminMsg) {
          items.push({
            id: `support_${latestAdminMsg.id}`,
            kind: 'support',
            title: tx('Phản hồi từ Hỗ trợ hệ thống', 'Reply from Support'),
            subtitle: latestAdminMsg.senderName,
            detail: latestAdminMsg.text,
            timestamp: latestAdminMsg.createdAt,
            actionLabel: tx('Mở hộp chat hỗ trợ', 'Open support chat'),
            tone: 'blue',
          });
        }
      }
    }

    return items
      .filter((item) => {
        const ts = Date.parse(item.timestamp) || 0;
        return ts > notifState.clearedAtMs;
      })
      .sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0))
      .slice(0, 30);
  }, [
    classAssignments,
    classJoinRequests,
    classMap,
    classMaterials,
    currentUser,
    enrolledClassIds,
    exams,
    language,
    notifState.clearedAtMs,
    notificationPrefs.classNotifications,
    notificationPrefs.examNotifications,
    notificationPrefs.otherNotifications,
    submittedExamIds,
    supportThreads,
    tx,
    userKey,
  ]);

  const readSet = useMemo(() => new Set(notifState.readIds), [notifState.readIds]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !readSet.has(item.id)).length,
    [notifications, readSet],
  );

  const filteredItems = useMemo(
    () => (filter === 'unread' ? notifications.filter((item) => !readSet.has(item.id)) : notifications),
    [filter, notifications, readSet],
  );

  const markRead = (id: string) => {
    updateNotifState((prev) =>
      prev.readIds.includes(id)
        ? prev
        : { ...prev, readIds: [...prev.readIds, id] },
    );
  };

  const markAllRead = () => {
    updateNotifState((prev) => ({
      ...prev,
      readIds: Array.from(new Set([...prev.readIds, ...notifications.map((n) => n.id)])),
    }));
  };

  const clearHistory = () => {
    const newestMs = notifications.reduce(
      (max, item) => Math.max(max, Date.parse(item.timestamp) || 0),
      Date.now(),
    );
    updateNotifState(() => ({
      readIds: [],
      clearedAtMs: newestMs,
    }));
  };

  const getVisualMeta = (item: StudentNotificationItem) => {
    const iconBoxClass =
      item.tone === 'emerald'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-300'
        : item.tone === 'red'
          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-300'
          : item.tone === 'amber'
            ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-300'
            : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/70 dark:bg-blue-950/60 dark:text-blue-300';

    const toneClass =
      item.tone === 'emerald'
        ? 'text-emerald-700 dark:text-emerald-300'
        : item.tone === 'red'
          ? 'text-red-700 dark:text-red-300'
          : item.tone === 'amber'
            ? 'text-amber-700 dark:text-amber-300'
            : 'text-blue-700 dark:text-blue-300';

    const Icon =
      item.kind === 'class_join'
        ? item.tone === 'red'
          ? UserX
          : item.tone === 'amber'
            ? Clock
            : UserCheck
        : item.kind === 'assignment'
          ? ClipboardList
          : item.kind === 'material'
            ? FileText
            : item.kind === 'support'
              ? Headphones
              : BookOpen;

    return { Icon, iconBoxClass, toneClass };
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={tx(
          `Thông báo học tập (${unreadCount} chưa đọc)`,
          `Student notifications (${unreadCount} unread)`,
        )}
        title={tx('Thông báo lớp học, bài tập & kỳ thi', 'Class, assignment & exam notifications')}
        className={`relative inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
          unreadCount > 0
            ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700/80 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-950'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
        }`}
      >
        <Bell className="h-4 w-4 shrink-0" />
        {unreadCount > 0 && (
          <span className="font-mono text-xs font-bold tabular-nums">{unreadCount}</span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={tx('Trung tâm thông báo học sinh', 'Student Notification Center')}
          className="fixed top-18 right-3 left-3 z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl sm:absolute sm:top-11 sm:right-0 sm:left-auto sm:w-[420px] dark:border-slate-800 dark:bg-slate-900"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                {tx('Thông báo học tập', 'Student Notifications')}
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                {unreadCount} {tx('chưa đọc', 'unread')} · {notifications.length}{' '}
                {tx('thông báo đã ghi nhận', 'notifications recorded')}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={tx('Đóng thông báo', 'Close notifications')}
              className="cursor-pointer rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'all', label: `${tx('Tất cả', 'All')} (${notifications.length})` },
                  { id: 'unread', label: `${tx('Chưa đọc', 'Unread')} (${unreadCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`cursor-pointer whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                    filter === tab.id
                      ? 'bg-blue-700 text-white dark:bg-blue-600'
                      : 'text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notification Feed */}
          <div className="flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {filteredItems.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {tx('Không có thông báo mới nào', 'No new notifications')}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {tx(
                    'Thông báo duyệt lớp, bài tập mới, tài liệu và kỳ thi đang mở sẽ hiển thị tại đây.',
                    'Class approvals, new assignments, materials, and active exams will appear here.',
                  )}
                </p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isRead = readSet.has(item.id);
                const visual = getVisualMeta(item);
                const Icon = visual.Icon;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      markRead(item.id);
                      if (item.kind === 'support') {
                        onOpenSupportChat?.();
                      } else if (item.targetSection) {
                        onSelectPortalSection?.(item.targetSection);
                      }
                      setOpen(false);
                    }}
                    className={`cursor-pointer px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                      !isRead ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${visual.iconBoxClass}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                          <span className={`font-semibold ${visual.toneClass}`}>
                            {item.title}
                            {!isRead && ` · ${tx('Mới', 'New')}`}
                          </span>
                          <span className="font-mono text-slate-400 tabular-nums dark:text-slate-500">
                            {formatRelativeTimeVi(item.timestamp, realtimeNow, language)} ·{' '}
                            {new Date(item.timestamp).toLocaleTimeString(
                              language === 'en' ? 'en-US' : 'vi-VN',
                            )}
                          </span>
                        </div>

                        <p className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {item.subtitle}
                        </p>

                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                          {item.detail}
                        </p>

                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                            <ExternalLink className="h-3 w-3" />
                            <span>{item.actionLabel}</span>
                          </span>
                          {!isRead && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                markRead(item.id);
                              }}
                              className="cursor-pointer text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                            >
                              {tx('Đánh dấu đã đọc', 'Mark as read')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] dark:border-slate-800 dark:bg-slate-950/60">
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex cursor-pointer items-center gap-1 font-semibold text-slate-700 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-400"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>{tx('Đọc tất cả', 'Mark all read')}</span>
              </button>
              <button
                type="button"
                onClick={clearHistory}
                className="inline-flex cursor-pointer items-center gap-1 font-semibold text-red-600 hover:underline dark:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{tx('Xóa lịch sử', 'Clear history')}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
