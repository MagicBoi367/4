import {
  CheckCircle2,
  Headphones,
  MessageSquare,
  RotateCcw,
  Send,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SupportChatThread, UserAccount, UserRole } from '../types/exam';
import { useLanguage } from '../utils/i18n';
import { formatRelativeTimeVi, useRealtimeNow } from '../utils/realtimeClient';
import {
  getOrCreateGuestSupportId,
  getSupportThreadIdForUser,
  markSupportThreadRead,
  sendSupportMessage,
  setSupportThreadStatus,
  useSupportChats,
} from '../utils/supportChatStore';

function formatMessageTime(iso: string, lang: 'vi' | 'en'): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return '';
  return new Date(parsed).toLocaleTimeString(lang === 'en' ? 'en-US' : 'vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getRoleBadgeLabel(
  role: UserRole | 'guest',
  t: ReturnType<typeof useLanguage>['t'],
): string {
  if (role === 'admin') return t.supportRoleAdmin;
  if (role === 'teacher') return t.supportRoleTeacher;
  if (role === 'student') return t.supportRoleStudent;
  return t.supportRoleGuest;
}

interface AdminSupportInboxProps {
  currentUser: UserAccount | null;
  compact?: boolean;
  initialThreadId?: string | null;
}

export function AdminSupportInbox({
  currentUser,
  compact = false,
  initialThreadId = null,
}: AdminSupportInboxProps) {
  const { language, t } = useLanguage();
  const threads = useSupportChats();
  const realtimeNow = useRealtimeNow(15_000);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(initialThreadId);
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialThreadId) {
      setSelectedThreadId(initialThreadId);
    }
  }, [initialThreadId]);

  const sortedThreads = useMemo(
    () =>
      [...threads].sort((a, b) => {
        const ta = Date.parse(a.updatedAt) || 0;
        const tb = Date.parse(b.updatedAt) || 0;
        return tb - ta;
      }),
    [threads],
  );

  useEffect(() => {
    if (sortedThreads.length === 0) {
      setSelectedThreadId(null);
      return;
    }
    if (!selectedThreadId || !sortedThreads.some((th) => th.id === selectedThreadId)) {
      setSelectedThreadId(sortedThreads[0].id);
    }
  }, [selectedThreadId, sortedThreads]);

  const activeThread: SupportChatThread | null = useMemo(
    () => sortedThreads.find((th) => th.id === selectedThreadId) ?? null,
    [selectedThreadId, sortedThreads],
  );

  useEffect(() => {
    if (activeThread && activeThread.unreadForAdmin > 0) {
      markSupportThreadRead(activeThread.id, 'admin');
    }
  }, [activeThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeThread?.messages.length, activeThread?.id]);

  const handleSendReply = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activeThread || !draft.trim()) return;
    const sent = sendSupportMessage({
      threadId: activeThread.id,
      text: draft,
      senderId: currentUser?.id ?? 'AD0001',
      senderName: currentUser?.fullName ?? t.supportAdminSenderName,
      senderRole: 'admin',
      threadUserId: activeThread.userId,
      threadUserName: activeThread.userName,
      threadUserEmail: activeThread.userEmail,
      threadUserRole: activeThread.userRole,
    });
    if (sent) {
      setDraft('');
    }
  };

  return (
    <div
      className={`grid grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white md:grid-cols-12 dark:border-slate-800 dark:bg-slate-900 ${
        compact ? 'h-[480px]' : 'h-[560px]'
      }`}
    >
      {/* Left Thread List */}
      <div className="flex flex-col border-b border-slate-200 md:col-span-4 md:border-r md:border-b-0 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-950/60">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
            {sortedThreads.length} {t.supportThreadCountSuffix}
          </span>
          {sortedThreads.some((th) => th.unreadForAdmin > 0) && (
            <span className="font-mono text-[11px] font-bold text-blue-700 tabular-nums dark:text-blue-400">
              {sortedThreads.reduce((sum, th) => sum + (th.unreadForAdmin || 0), 0)}{' '}
              {t.supportUnreadBadge}
            </span>
          )}
        </div>
        <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
          {sortedThreads.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <MessageSquare className="h-8 w-8 text-slate-300 dark:text-slate-700" />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {t.supportEmptyAdminList}
              </p>
            </div>
          ) : (
            sortedThreads.map((th) => {
              const isSelected = th.id === activeThread?.id;
              const lastMsg = th.messages[th.messages.length - 1];
              return (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => setSelectedThreadId(th.id)}
                  className={`flex w-full cursor-pointer flex-col gap-1 px-3.5 py-3 text-left transition-colors ${
                    isSelected
                      ? 'bg-blue-50/80 dark:bg-blue-950/40'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                        {th.userName}
                      </span>
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {getRoleBadgeLabel(th.userRole, t)}
                      </span>
                    </div>
                    {th.unreadForAdmin > 0 && (
                      <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 font-mono text-[10px] font-bold text-white tabular-nums">
                        {th.unreadForAdmin}
                      </span>
                    )}
                  </div>
                  {lastMsg && (
                    <p className="truncate text-[11px] text-slate-600 dark:text-slate-400">
                      {lastMsg.senderRole === 'admin' ? `${t.supportRoleAdmin}: ` : ''}
                      {lastMsg.text}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                    <span
                      className={
                        th.status === 'resolved'
                          ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                          : 'font-semibold text-amber-600 dark:text-amber-400'
                      }
                    >
                      {th.status === 'resolved' ? t.supportStatusResolved : t.supportStatusOpen}
                    </span>
                    <span>
                      {formatRelativeTimeVi(th.updatedAt, realtimeNow, language) ||
                        formatMessageTime(th.updatedAt, language)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Chat Conversation */}
      <div className="flex min-h-0 flex-col md:col-span-8">
        {activeThread ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                    {activeThread.userName}
                  </p>
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    ({activeThread.userId})
                  </span>
                </div>
                {activeThread.userEmail && (
                  <p className="mt-0.5 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {activeThread.userEmail}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  setSupportThreadStatus(
                    activeThread.id,
                    activeThread.status === 'resolved' ? 'open' : 'resolved',
                  )
                }
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  activeThread.status === 'resolved'
                    ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300'
                }`}
              >
                {activeThread.status === 'resolved' ? (
                  <>
                    <RotateCcw className="h-3 w-3" />
                    <span>{t.supportReopenThread}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    <span>{t.supportMarkResolved}</span>
                  </>
                )}
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {activeThread.messages.map((m) => {
                const isMine = m.senderRole === 'admin';
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold">
                        {isMine ? `${m.senderName} (${t.supportRoleAdmin})` : m.senderName}
                      </span>
                      <span>·</span>
                      <span className="tabular-nums">
                        {formatMessageTime(m.createdAt, language)}
                      </span>
                    </div>
                    <div
                      className={`max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                        isMine
                          ? 'rounded-tr-sm bg-blue-600 text-white dark:bg-blue-600'
                          : 'rounded-tl-sm border border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={handleSendReply}
              className="flex items-center gap-2 border-t border-slate-200 p-3 dark:border-slate-800"
            >
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t.supportPlaceholderAdmin}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{t.supportSendBtn}</span>
              </button>
            </form>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <ShieldCheck className="h-9 w-9 text-slate-300 dark:text-slate-700" />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {t.supportSelectThreadHint}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface SupportChatModalProps {
  currentUser: UserAccount | null;
  role: UserRole;
  initialThreadId?: string | null;
  onOpenAdminSupport?: () => void;
  onClose: () => void;
}

export function SupportChatModal({
  currentUser,
  role,
  initialThreadId = null,
  onOpenAdminSupport,
  onClose,
}: SupportChatModalProps) {
  const { language, t } = useLanguage();
  const threads = useSupportChats();
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = currentUser?.role === 'admin' || (!currentUser && role === 'admin');
  const threadId = useMemo(() => getSupportThreadIdForUser(currentUser), [currentUser]);
  const myThread = useMemo(
    () => threads.find((th) => th.id === threadId) ?? null,
    [threads, threadId],
  );

  useEffect(() => {
    if (!isAdmin && myThread && myThread.unreadForUser > 0) {
      markSupportThreadRead(myThread.id, currentUser?.role ?? 'guest');
    }
  }, [isAdmin, myThread, currentUser?.role]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [myThread?.messages.length]);

  const handleUserSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!draft.trim()) return;
    const guestId = getOrCreateGuestSupportId();
    const senderId = currentUser?.id ?? guestId;
    const senderName =
      currentUser?.fullName ?? `${t.supportGuestPrefix} (${guestId.slice(-4).toUpperCase()})`;
    const senderRole: UserRole | 'guest' = currentUser?.role ?? 'guest';

    const sent = sendSupportMessage({
      threadId,
      text: draft,
      senderId,
      senderName,
      senderRole,
      threadUserId: senderId,
      threadUserName: senderName,
      threadUserEmail: currentUser?.email,
      threadUserRole: senderRole,
    });
    if (sent) {
      setDraft('');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-chat-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs dark:bg-slate-950/80"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 ${
          isAdmin ? 'max-w-4xl' : 'max-w-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
              <Headphones className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="support-chat-modal-title"
                className="truncate font-display text-sm font-bold text-slate-900 sm:text-base dark:text-slate-50"
              >
                {isAdmin ? t.supportModalTitleAdmin : t.supportModalTitleUser}
              </h2>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {isAdmin ? t.supportModalSubtitleAdmin : t.supportModalSubtitleUser}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isAdmin && onOpenAdminSupport && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAdminSupport();
                }}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {t.supportOpenInAdminBtn}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={t.settingsCloseAria}
              className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        {isAdmin ? (
          <div className="p-4">
            <AdminSupportInbox
              currentUser={currentUser}
              initialThreadId={initialThreadId}
              compact
            />
          </div>
        ) : (
          <div className="flex h-[460px] flex-col">
            {myThread && (
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-2 text-[11px] dark:border-slate-800 dark:bg-slate-950/50">
                <span className="font-medium text-slate-600 dark:text-slate-400">
                  {currentUser
                    ? `${currentUser.fullName} · ${currentUser.id}`
                    : t.supportRoleGuest}
                </span>
                <span
                  className={`font-semibold ${
                    myThread.status === 'resolved'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {myThread.status === 'resolved'
                    ? t.supportStatusResolved
                    : t.supportStatusOpen}
                </span>
              </div>
            )}

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
              {!myThread || myThread.messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <p className="mt-3 max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {t.supportEmptyUser}
                  </p>
                </div>
              ) : (
                myThread.messages.map((m) => {
                  const isFromAdmin = m.senderRole === 'admin';
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isFromAdmin ? 'items-start' : 'items-end'}`}
                    >
                      <div className="mb-1 flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                        <span className="font-semibold">
                          {isFromAdmin ? `${m.senderName} (${t.supportRoleAdmin})` : m.senderName}
                        </span>
                        <span>·</span>
                        <span className="tabular-nums">
                          {formatMessageTime(m.createdAt, language)}
                        </span>
                      </div>
                      <div
                        className={`max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                          isFromAdmin
                            ? 'rounded-tl-sm border border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                            : 'rounded-tr-sm bg-blue-600 text-white dark:bg-blue-600'
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={handleUserSend}
              className="flex items-center gap-2 border-t border-slate-200 p-4 dark:border-slate-800"
            >
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t.supportPlaceholderUser}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{t.supportSendBtn}</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export interface SupportChatToastItem {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole | 'guest';
  threadUserId: string;
  threadUserName: string;
  threadUserEmail?: string;
  threadUserRole: UserRole | 'guest';
  text: string;
  createdAt: string;
}

interface SupportChatToastStackProps {
  toasts: SupportChatToastItem[];
  currentUser: UserAccount | null;
  role: UserRole;
  onDismiss: (messageId: string) => void;
  onOpenThread: (threadId: string) => void;
}

export function SupportChatToastStack({
  toasts,
  currentUser,
  role,
  onDismiss,
  onOpenThread,
}: SupportChatToastStackProps) {
  const { language, t } = useLanguage();
  const realtimeNow = useRealtimeNow(10_000);
  const [quickDrafts, setQuickDrafts] = useState<Record<string, string>>({});

  if (toasts.length === 0) return null;

  const viewerIsAdmin = currentUser?.role === 'admin' || (!currentUser && role === 'admin');

  const handleQuickReply = (item: SupportChatToastItem, e: React.FormEvent) => {
    e.preventDefault();
    const replyText = (quickDrafts[item.id] ?? '').trim();
    if (!replyText) return;

    const guestId = getOrCreateGuestSupportId();
    const senderId = viewerIsAdmin
      ? (currentUser?.id ?? 'AD0001')
      : (currentUser?.id ?? guestId);
    const senderName = viewerIsAdmin
      ? (currentUser?.fullName ?? t.supportAdminSenderName)
      : (currentUser?.fullName ?? `${t.supportGuestPrefix} (${guestId.slice(-4).toUpperCase()})`);
    const senderRole: UserRole | 'guest' = viewerIsAdmin
      ? 'admin'
      : (currentUser?.role ?? 'guest');

    const sent = sendSupportMessage({
      threadId: item.threadId,
      text: replyText,
      senderId,
      senderName,
      senderRole,
      threadUserId: item.threadUserId,
      threadUserName: item.threadUserName,
      threadUserEmail: item.threadUserEmail,
      threadUserRole: item.threadUserRole,
    });

    if (sent) {
      markSupportThreadRead(item.threadId, viewerIsAdmin ? 'admin' : senderRole);
      setQuickDrafts((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      onDismiss(item.id);
    }
  };

  return (
    <div
      aria-live="polite"
      aria-label={t.supportToastIncomingAdmin}
      className="pointer-events-auto flex w-full flex-col gap-2.5"
    >
      {toasts.slice(0, 2).map((item) => {
        const isFromAdmin = item.senderRole === 'admin';
        const draftValue = quickDrafts[item.id] ?? '';
        return (
          <div
            key={item.id}
            role="status"
            className="animate-view-enter rounded-xl border border-blue-200 bg-white p-3.5 shadow-xl dark:border-blue-900/70 dark:bg-slate-900"
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/70 dark:bg-blue-950/60 dark:text-blue-300">
                <Headphones className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-bold text-blue-700 dark:text-blue-400">
                    {isFromAdmin
                      ? t.supportToastIncomingReply
                      : t.supportToastIncomingAdmin}
                  </span>
                  <span className="font-mono text-slate-400 tabular-nums dark:text-slate-500">
                    {formatRelativeTimeVi(item.createdAt, realtimeNow, language) ||
                      formatMessageTime(item.createdAt, language)}
                  </span>
                </div>

                <div className="mt-0.5 flex items-center gap-1.5">
                  <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-50">
                    {item.senderName}
                  </p>
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {getRoleBadgeLabel(item.senderRole, t)}
                  </span>
                </div>

                <p className="mt-1.5 line-clamp-3 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
                  {item.text}
                </p>

                <form
                  onSubmit={(e) => handleQuickReply(item, e)}
                  className="mt-2 flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={draftValue}
                    onChange={(e) =>
                      setQuickDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    placeholder={t.supportToastQuickReplyPlaceholder}
                    className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                  <button
                    type="submit"
                    disabled={!draftValue.trim()}
                    aria-label={t.supportToastSendAria}
                    className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md bg-blue-600 p-1.5 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      markSupportThreadRead(
                        item.threadId,
                        viewerIsAdmin ? 'admin' : (currentUser?.role ?? 'guest'),
                      );
                      onDismiss(item.id);
                      onOpenThread(item.threadId);
                    }}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-950"
                  >
                    <MessageSquare className="h-3 w-3" />
                    <span>{t.supportToastOpenChat}</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                aria-label={t.supportToastCloseAria}
                onClick={() => onDismiss(item.id)}
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
