import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCheck,
  ExternalLink,
  Minimize2,
  Pause,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserPlus,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClassJoinRequest, TeacherAlert } from '../types/exam';
import { type AppLanguage, useLanguage } from '../utils/i18n';
import { formatRelativeTimeVi, useRealtimeNow } from '../utils/realtimeClient';

function getAlertVisualMeta(alert: TeacherAlert, lang: AppLanguage) {
  if (alert.actionType === 'class_join_request') {
    return {
      Icon: UserPlus,
      severityLabel:
        lang === 'en' ? 'Class Join Request (Pending)' : 'Xin vào lớp (Chờ duyệt)',
      toneClass: 'text-amber-700 dark:text-amber-300',
      iconBoxClass:
        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-300',
    };
  }
  if (alert.actionType === 'class_joined') {
    return {
      Icon: UserCheck,
      severityLabel: lang === 'en' ? 'Joined Class' : 'Tham gia lớp học',
      toneClass: 'text-emerald-700 dark:text-emerald-300',
      iconBoxClass:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-300',
    };
  }
  if (alert.actionType === 'network_offline') {
    return {
      Icon: WifiOff,
      severityLabel: lang === 'en' ? 'Connection Lost' : 'Mất kết nối',
      toneClass: 'text-red-700 dark:text-red-300',
      iconBoxClass:
        'border-red-200 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-300',
    };
  }
  if (alert.actionType === 'fullscreen_exited') {
    return {
      Icon: Minimize2,
      severityLabel: lang === 'en' ? 'Exited Fullscreen' : 'Thoát toàn màn hình',
      toneClass: 'text-amber-700 dark:text-amber-300',
      iconBoxClass:
        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-300',
    };
  }
  if (alert.actionType === 'paused_exam') {
    return {
      Icon: Pause,
      severityLabel: lang === 'en' ? 'Exam Paused' : 'Tạm dừng bài thi',
      toneClass: 'text-amber-700 dark:text-amber-300',
      iconBoxClass:
        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-300',
    };
  }
  if (alert.severity === 'critical') {
    return {
      Icon: ShieldAlert,
      severityLabel: lang === 'en' ? 'Critical Alert' : 'Cảnh báo nghiêm trọng',
      toneClass: 'text-red-700 dark:text-red-300',
      iconBoxClass:
        'border-red-200 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-300',
    };
  }
  return {
    Icon: AlertTriangle,
    severityLabel: lang === 'en' ? 'Proctoring Alert' : 'Cảnh báo giám sát',
    toneClass: 'text-amber-700 dark:text-amber-300',
    iconBoxClass:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-300',
  };
}

interface TeacherNotificationBellProps {
  alerts: TeacherAlert[];
  classJoinRequests?: ClassJoinRequest[];
  soundEnabled: boolean;
  onToggleSound: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onInspectAlert: (alert: TeacherAlert) => void;
  onApproveClassJoin?: (alert: TeacherAlert) => void;
  onDismissClassJoin?: (alert: TeacherAlert) => void;
  onTriggerTestAlert: () => void;
}

export function TeacherNotificationBell({
  alerts,
  classJoinRequests = [],
  soundEnabled,
  onToggleSound,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  onInspectAlert,
  onApproveClassJoin,
  onDismissClassJoin,
  onTriggerTestAlert,
}: TeacherNotificationBellProps) {
  const { language, tx } = useLanguage();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const realtimeNow = useRealtimeNow(10_000);

  const joinRequestMap = useMemo(
    () => new Map(classJoinRequests.map((r) => [r.id, r])),
    [classJoinRequests],
  );

  const unreadCount = useMemo(
    () => alerts.filter((a) => !a.read).length,
    [alerts],
  );
  const criticalCount = useMemo(
    () => alerts.filter((a) => a.severity === 'critical').length,
    [alerts],
  );

  const filteredAlerts = useMemo(() => {
    if (filter === 'unread') return alerts.filter((a) => !a.read);
    if (filter === 'critical') return alerts.filter((a) => a.severity === 'critical');
    return alerts;
  }, [alerts, filter]);

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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={tx(
          `Thông báo lớp học và giám sát (${unreadCount} chưa đọc)`,
          `Class & proctoring notifications (${unreadCount} unread)`,
        )}
        title={tx('Thông báo lớp học & giám sát phòng thi', 'Class & exam proctoring notifications')}
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
          aria-label={tx('Trung tâm thông báo giáo viên', 'Teacher Notification Center')}
          className="fixed top-18 right-3 left-3 z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl sm:absolute sm:top-11 sm:right-0 sm:left-auto sm:w-[420px] dark:border-slate-800 dark:bg-slate-900"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                {tx('Thông báo lớp học & giám sát', 'Class & Proctoring Alerts')}
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                {unreadCount} {tx('chưa đọc', 'unread')} · {alerts.length}{' '}
                {tx('thông báo đã ghi nhận', 'notifications recorded')}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleSound}
                title={soundEnabled ? tx('Tắt âm báo đẩy', 'Mute alert sound') : tx('Bật âm báo đẩy', 'Enable alert sound')}
                aria-label={soundEnabled ? tx('Tắt âm báo đẩy', 'Mute alert sound') : tx('Bật âm báo đẩy', 'Enable alert sound')}
                className="cursor-pointer rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {soundEnabled ? (
                  <Volume2 className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={tx('Đóng thông báo', 'Close notifications')}
                className="cursor-pointer rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Tabs & Quick Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'all', label: `${tx('Tất cả', 'All')} (${alerts.length})` },
                  { id: 'unread', label: `${tx('Chưa đọc', 'Unread')} (${unreadCount})` },
                  { id: 'critical', label: `${tx('Nghiêm trọng', 'Critical')} (${criticalCount})` },
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

            <button
              type="button"
              onClick={onTriggerTestAlert}
              className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-blue-700 hover:underline dark:text-blue-400"
            >
              <BellRing className="h-3 w-3" />
              <span>{tx('Thử cảnh báo', 'Test alert')}</span>
            </button>
          </div>

          {/* Notification Feed */}
          <div className="flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {filteredAlerts.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {tx('Không có thông báo mới nào', 'No new notifications')}
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {tx(
                    'Thông báo học sinh tham gia lớp học và cảnh báo giám sát phòng thi sẽ tự động đẩy về đây.',
                    'Class join updates and live exam proctoring alerts will appear here automatically.',
                  )}
                </p>
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const visual = getAlertVisualMeta(alert, language);
                const Icon = visual.Icon;
                const isClassJoin =
                  alert.alertCategory === 'class_join' ||
                  alert.actionType === 'class_join_request' ||
                  alert.actionType === 'class_joined';
                const matchedReq =
                  isClassJoin && alert.joinRequestId
                    ? joinRequestMap.get(alert.joinRequestId)
                    : undefined;
                const needsApproval =
                  isClassJoin &&
                  alert.requiresApproval &&
                  matchedReq?.status === 'pending';

                return (
                  <div
                    key={alert.id}
                    onClick={() => {
                      onMarkRead(alert.id);
                      onInspectAlert(alert);
                      setOpen(false);
                    }}
                    className={`cursor-pointer px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                      !alert.read ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
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
                            {alert.title}
                            {!alert.read && ` · ${tx('Mới', 'New')}`}
                          </span>
                          <span className="font-mono text-slate-400 tabular-nums dark:text-slate-500">
                            {formatRelativeTimeVi(alert.timestamp, realtimeNow, language)} ·{' '}
                            {new Date(alert.timestamp).toLocaleTimeString(
                              language === 'en' ? 'en-US' : 'vi-VN',
                            )}
                          </span>
                        </div>

                        {isClassJoin ? (
                          <p className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {alert.studentName}
                            {alert.studentClass && alert.studentClass !== '—'
                              ? ` · ${tx('Lớp', 'Class')} ${alert.studentClass}`
                              : ''}{' '}
                            ·{' '}
                            <span className="font-mono text-blue-700 dark:text-blue-400">
                              {alert.classCode ?? alert.roomCode}
                            </span>
                          </p>
                        ) : (
                          <p className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {alert.studentName} ·{' '}
                            <span className="font-mono tabular-nums">
                              {tx('SBD', 'ID')} {alert.studentSbd}
                            </span>{' '}
                            · {alert.roomCode}
                          </p>
                        )}

                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                          {alert.detail}
                        </p>

                        {isClassJoin ? (
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            {needsApproval ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onApproveClassJoin?.(alert);
                                  }}
                                  className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                                >
                                  <UserCheck className="h-3 w-3" />
                                  <span>{tx('Duyệt', 'Approve')}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onDismissClassJoin) {
                                      onDismissClassJoin(alert);
                                    } else {
                                      onMarkRead(alert.id);
                                    }
                                  }}
                                  className="cursor-pointer rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                  {tx('Bỏ qua', 'Dismiss')}
                                </button>
                              </div>
                            ) : alert.requiresApproval ? (
                              <span
                                className={`text-[11px] font-semibold ${
                                  matchedReq?.status === 'approved'
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : matchedReq?.status === 'rejected'
                                      ? 'text-red-600 dark:text-red-400'
                                      : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {matchedReq?.status === 'approved'
                                  ? tx('Đã duyệt vào lớp', 'Approved')
                                  : matchedReq?.status === 'rejected'
                                    ? tx('Đã từ chối', 'Rejected')
                                    : tx('Đã xử lý', 'Processed')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                                <ExternalLink className="h-3 w-3" />
                                <span>{tx('Xem thành viên lớp', 'View class members')}</span>
                              </span>
                            )}

                            {!alert.read && !needsApproval && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMarkRead(alert.id);
                                }}
                                className="cursor-pointer text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                              >
                                {tx('Đánh dấu đã đọc', 'Mark as read')}
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="mt-1.5 flex items-center justify-between">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                              <ExternalLink className="h-3 w-3" />
                              <span>{tx('Xem nhật ký & kết quả', 'View logs & results')}</span>
                            </span>
                            {!alert.read && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMarkRead(alert.id);
                                }}
                                className="cursor-pointer text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                              >
                                {tx('Đánh dấu đã đọc', 'Mark as read')}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {alerts.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] dark:border-slate-800 dark:bg-slate-950/60">
              <button
                type="button"
                onClick={onMarkAllRead}
                className="inline-flex cursor-pointer items-center gap-1 font-semibold text-slate-700 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-400"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>{tx('Đọc tất cả', 'Mark all read')}</span>
              </button>
              <button
                type="button"
                onClick={onClearAll}
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

interface TeacherAlertToastStackProps {
  toasts: TeacherAlert[];
  classJoinRequests?: ClassJoinRequest[];
  embedded?: boolean;
  onDismiss: (id: string) => void;
  onInspectAlert: (alert: TeacherAlert) => void;
  onApproveClassJoin?: (alert: TeacherAlert) => void;
  onDismissClassJoin?: (alert: TeacherAlert) => void;
}

export function TeacherAlertToastStack({
  toasts,
  classJoinRequests = [],
  embedded = false,
  onDismiss,
  onInspectAlert,
  onApproveClassJoin,
  onDismissClassJoin,
}: TeacherAlertToastStackProps) {
  const { language, tx } = useLanguage();
  const realtimeNow = useRealtimeNow(10_000);
  const joinRequestMap = useMemo(
    () => new Map(classJoinRequests.map((r) => [r.id, r])),
    [classJoinRequests],
  );

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      aria-label={tx('Thông báo đẩy lớp học và giám sát', 'Live class & proctoring notifications')}
      className={
        embedded
          ? 'pointer-events-auto flex w-full flex-col gap-2.5'
          : 'no-print fixed right-4 bottom-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2.5'
      }
    >
      {toasts.slice(0, 3).map((alert) => {
        const visual = getAlertVisualMeta(alert, language);
        const Icon = visual.Icon;
        const isClassJoin =
          alert.alertCategory === 'class_join' ||
          alert.actionType === 'class_join_request' ||
          alert.actionType === 'class_joined';
        const matchedReq =
          isClassJoin && alert.joinRequestId
            ? joinRequestMap.get(alert.joinRequestId)
            : undefined;
        const needsApproval =
          isClassJoin && alert.requiresApproval && matchedReq?.status === 'pending';

        return (
          <div
            key={alert.id}
            role="alert"
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${visual.iconBoxClass}`}
              >
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className={`font-bold ${visual.toneClass}`}>
                    {visual.severityLabel}
                  </span>
                  <span className="font-mono text-slate-400 tabular-nums dark:text-slate-500">
                    {formatRelativeTimeVi(alert.timestamp, realtimeNow, language)} ·{' '}
                    {new Date(alert.timestamp).toLocaleTimeString(
                      language === 'en' ? 'en-US' : 'vi-VN',
                    )}
                  </span>
                </div>

                {isClassJoin ? (
                  <p className="mt-0.5 text-xs font-bold text-slate-900 dark:text-slate-50">
                    {alert.studentName}
                    {alert.studentClass && alert.studentClass !== '—'
                      ? ` · ${tx('Lớp', 'Class')} ${alert.studentClass}`
                      : ''}{' '}
                    ({alert.classCode ?? alert.roomCode})
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs font-bold text-slate-900 dark:text-slate-50">
                    {alert.studentName} · {tx('SBD', 'ID')} {alert.studentSbd} ({alert.roomCode})
                  </p>
                )}
                <p className="mt-1 text-xs leading-snug text-slate-600 dark:text-slate-300">
                  {alert.detail}
                </p>

                <div className="mt-2.5 flex items-center gap-2.5">
                  {needsApproval ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onApproveClassJoin?.(alert)}
                        className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                      >
                        <UserCheck className="h-3 w-3" />
                        <span>{tx('Duyệt', 'Approve')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onDismissClassJoin) {
                            onDismissClassJoin(alert);
                          } else {
                            onDismiss(alert.id);
                          }
                        }}
                        className="cursor-pointer whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-slate-100"
                      >
                        {tx('Bỏ qua', 'Dismiss')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onInspectAlert(alert)}
                        className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md bg-blue-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500"
                      >
                        <span>
                          {isClassJoin
                            ? tx('Xem thành viên', 'View members')
                            : tx('Xem giám sát', 'Inspect')}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDismiss(alert.id)}
                        className="cursor-pointer whitespace-nowrap text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                      >
                        {tx('Bỏ qua', 'Dismiss')}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <button
                type="button"
                aria-label={tx('Đóng thông báo đẩy', 'Close notification')}
                onClick={() => onDismiss(alert.id)}
                className="cursor-pointer rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
