import { useEffect, useState } from 'react';
import type {
  SupportChatMessage,
  SupportChatThread,
  UserAccount,
  UserRole,
} from '../types/exam';
import {
  getRealtimeNow,
  sendRealtimeMutation,
  subscribeRealtimeMessages,
} from './realtimeClient';

const SUPPORT_CHATS_STORAGE_KEY = 'kythi2025_support_chats_v1';
const SUPPORT_CHATS_SYNC_EVENT = 'kythi2025:support-chats-updated';
const GUEST_SUPPORT_ID_KEY = 'kythi2025_guest_support_id_v1';

export function getOrCreateGuestSupportId(): string {
  if (typeof window === 'undefined') return 'guest_default';
  try {
    const existing = localStorage.getItem(GUEST_SUPPORT_ID_KEY);
    if (existing && existing.trim()) return existing.trim();
    const generated = `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    localStorage.setItem(GUEST_SUPPORT_ID_KEY, generated);
    return generated;
  } catch {
    return 'guest_default';
  }
}

export function getSupportThreadIdForUser(currentUser: UserAccount | null): string {
  if (currentUser) {
    return `support_${currentUser.id}`;
  }
  return `support_${getOrCreateGuestSupportId()}`;
}

export function readSupportChats(): SupportChatThread[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SUPPORT_CHATS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SupportChatThread[]) : [];
  } catch {
    return [];
  }
}

function saveSupportChatsLocal(threads: SupportChatThread[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SUPPORT_CHATS_STORAGE_KEY, JSON.stringify(threads));
  } catch {
    // Ignore storage quota errors
  }
  window.dispatchEvent(
    new CustomEvent<SupportChatThread[]>(SUPPORT_CHATS_SYNC_EVENT, { detail: threads }),
  );
}

if (typeof window !== 'undefined') {
  subscribeRealtimeMessages((msg) => {
    if (msg.type === 'snapshot' && Array.isArray(msg.data.supportChats)) {
      saveSupportChatsLocal(msg.data.supportChats as SupportChatThread[]);
    } else if (
      msg.type === 'slice:updated' &&
      msg.slice === 'supportChats' &&
      Array.isArray(msg.value)
    ) {
      saveSupportChatsLocal(msg.value as SupportChatThread[]);
    } else if (
      msg.type === 'batch:updated' &&
      Array.isArray(msg.patches.supportChats)
    ) {
      saveSupportChatsLocal(msg.patches.supportChats as SupportChatThread[]);
    }
  });
}

export function subscribeSupportChats(
  listener: (threads: SupportChatThread[]) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const onSync = (e: Event) => {
    const detail = (e as CustomEvent<SupportChatThread[]>).detail;
    listener(Array.isArray(detail) ? detail : readSupportChats());
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === SUPPORT_CHATS_STORAGE_KEY) {
      listener(readSupportChats());
    }
  };
  window.addEventListener(SUPPORT_CHATS_SYNC_EVENT, onSync);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(SUPPORT_CHATS_SYNC_EVENT, onSync);
    window.removeEventListener('storage', onStorage);
  };
}

export function useSupportChats(): SupportChatThread[] {
  const [threads, setThreads] = useState<SupportChatThread[]>(() => readSupportChats());

  useEffect(() => {
    setThreads(readSupportChats());
    return subscribeSupportChats(setThreads);
  }, []);

  return threads;
}

export interface SendSupportMessageInput {
  threadId: string;
  text: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole | 'guest';
  threadUserId: string;
  threadUserName: string;
  threadUserEmail?: string;
  threadUserRole: UserRole | 'guest';
}

export function sendSupportMessage(input: SendSupportMessageInput): SupportChatMessage | null {
  const cleanText = input.text.trim();
  if (!cleanText || !input.threadId) return null;

  const createdAt = new Date(getRealtimeNow()).toISOString();
  const message: SupportChatMessage = {
    id: `supmsg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    threadId: input.threadId,
    senderId: input.senderId,
    senderName: input.senderName,
    senderRole: input.senderRole,
    text: cleanText,
    createdAt,
  };

  const isFromAdmin = input.senderRole === 'admin';
  const current = readSupportChats();
  const idx = current.findIndex((t) => t.id === input.threadId);
  let next: SupportChatThread[];

  if (idx >= 0) {
    const existing = current[idx];
    const updated: SupportChatThread = {
      ...existing,
      userName: !isFromAdmin ? input.threadUserName : existing.userName,
      userEmail: !isFromAdmin ? input.threadUserEmail : existing.userEmail,
      userRole: !isFromAdmin ? input.threadUserRole : existing.userRole,
      status: !isFromAdmin ? 'open' : existing.status,
      updatedAt: createdAt,
      unreadForAdmin: isFromAdmin
        ? existing.unreadForAdmin
        : (existing.unreadForAdmin || 0) + 1,
      unreadForUser: isFromAdmin
        ? (existing.unreadForUser || 0) + 1
        : existing.unreadForUser,
      messages: [...existing.messages, message].slice(-200),
    };
    next = [updated, ...current.filter((t) => t.id !== input.threadId)];
  } else {
    const createdThread: SupportChatThread = {
      id: input.threadId,
      userId: input.threadUserId,
      userName: input.threadUserName,
      userEmail: input.threadUserEmail,
      userRole: input.threadUserRole,
      status: 'open',
      updatedAt: createdAt,
      unreadForAdmin: isFromAdmin ? 0 : 1,
      unreadForUser: isFromAdmin ? 1 : 0,
      messages: [message],
    };
    next = [createdThread, ...current];
  }

  saveSupportChatsLocal(next);
  sendRealtimeMutation({
    type: 'support:message',
    threadId: input.threadId,
    userId: input.threadUserId,
    userName: input.threadUserName,
    userEmail: input.threadUserEmail,
    userRole: input.threadUserRole,
    message,
  });

  return message;
}

export function markSupportThreadRead(
  threadId: string,
  viewerRole: UserRole | 'guest',
): void {
  if (!threadId) return;
  const viewerIsAdmin = viewerRole === 'admin';
  const current = readSupportChats();
  let changed = false;
  const next = current.map((t) => {
    if (t.id !== threadId) return t;
    if (viewerIsAdmin && t.unreadForAdmin > 0) {
      changed = true;
      return { ...t, unreadForAdmin: 0 };
    }
    if (!viewerIsAdmin && t.unreadForUser > 0) {
      changed = true;
      return { ...t, unreadForUser: 0 };
    }
    return t;
  });

  if (changed) {
    saveSupportChatsLocal(next);
    sendRealtimeMutation({
      type: 'support:mark_read',
      threadId,
      viewerRole,
    });
  }
}

export function setSupportThreadStatus(
  threadId: string,
  status: 'open' | 'resolved',
): void {
  if (!threadId) return;
  const current = readSupportChats();
  let changed = false;
  const next = current.map((t) => {
    if (t.id !== threadId || t.status === status) return t;
    changed = true;
    return { ...t, status };
  });
  if (changed) {
    saveSupportChatsLocal(next);
    sendRealtimeMutation({
      type: 'support:thread_status',
      threadId,
      status,
    });
  }
}

export function clearSupportChatsLocalAndServer(opts?: { skipRemote?: boolean }): void {
  saveSupportChatsLocal([]);
  if (!opts?.skipRemote) {
    sendRealtimeMutation({
      type: 'slice:set',
      slice: 'supportChats',
      value: [],
    });
  }
}
