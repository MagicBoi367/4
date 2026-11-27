import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'realtime-store.json');

const VALID_SLICES = new Set([
  'questions',
  'exams',
  'submissions',
  'privateClasses',
  'classJoinRequests',
  'classMaterials',
  'classAssignments',
  'classSchedules',
  'systemConfig',
  'accounts',
  'customSubjects',
  'teacherAlerts',
  'systemLogs',
  'supportChats',
]);

interface StoreFileShape {
  initialized: boolean;
  version: number;
  data: Record<string, unknown>;
}

const storeState: StoreFileShape = {
  initialized: false,
  version: 0,
  data: {},
};

function loadStoreFromDisk(): void {
  try {
    if (!fs.existsSync(STORE_FILE)) return;
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<StoreFileShape>;
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.initialized &&
      parsed.data &&
      typeof parsed.data === 'object'
    ) {
      storeState.initialized = true;
      storeState.version = typeof parsed.version === 'number' ? parsed.version : 1;
      for (const [k, v] of Object.entries(parsed.data)) {
        if (VALID_SLICES.has(k)) {
          storeState.data[k] = v;
        }
      }
    }
  } catch (err) {
    console.error('[realtime] Failed to load store from disk:', err);
  }
}

let flushTimer: NodeJS.Timeout | null = null;

function flushStoreSync(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${STORE_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(storeState), 'utf8');
    fs.renameSync(tmpFile, STORE_FILE);
  } catch (err) {
    console.error('[realtime] Failed to flush store to disk:', err);
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushStoreSync();
  }, 120);
}

interface IncomingMutation {
  type?: string;
  slice?: string;
  value?: unknown;
  patches?: Record<string, unknown>;
  item?: { id?: string } & Record<string, unknown>;
  prepend?: boolean;
  id?: string;
  alert?: { id?: string } & Record<string, unknown>;
  entry?: { id?: string } & Record<string, unknown>;
  threadId?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  message?: {
    id?: string;
    threadId?: string;
    senderId?: string;
    senderName?: string;
    senderRole?: string;
    text?: string;
    createdAt?: string;
  };
  viewerRole?: string;
  status?: 'open' | 'resolved';
  data?: Record<string, unknown>;
  clientId?: string;
}

function applyMutation(msg: IncomingMutation): {
  ok: boolean;
  broadcastPayload?: Record<string, unknown>;
} {
  const now = Date.now();
  const sourceClientId = typeof msg.clientId === 'string' ? msg.clientId : '';

  switch (msg.type) {
    case 'seed:init': {
      if (storeState.initialized || !msg.data || typeof msg.data !== 'object') {
        return { ok: true };
      }
      for (const [k, v] of Object.entries(msg.data)) {
        if (VALID_SLICES.has(k) && v !== undefined) {
          storeState.data[k] = v;
        }
      }
      storeState.initialized = true;
      storeState.version += 1;
      scheduleFlush();
      return {
        ok: true,
        broadcastPayload: {
          type: 'snapshot',
          reason: 'seed',
          initialized: true,
          version: storeState.version,
          serverTime: now,
          data: storeState.data,
          sourceClientId,
        },
      };
    }

    case 'reset:all': {
      if (!msg.data || typeof msg.data !== 'object') {
        return { ok: false };
      }
      const nextData: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(msg.data)) {
        if (VALID_SLICES.has(k) && v !== undefined) {
          nextData[k] = v;
        }
      }
      storeState.data = nextData;
      storeState.initialized = true;
      storeState.version += 1;
      scheduleFlush();
      return {
        ok: true,
        broadcastPayload: {
          type: 'snapshot',
          reason: 'reset',
          initialized: true,
          version: storeState.version,
          serverTime: now,
          data: storeState.data,
          sourceClientId,
        },
      };
    }

    case 'slice:set': {
      if (!msg.slice || !VALID_SLICES.has(msg.slice)) {
        return { ok: false };
      }
      storeState.data[msg.slice] = msg.value;
      storeState.initialized = true;
      storeState.version += 1;
      scheduleFlush();
      return {
        ok: true,
        broadcastPayload: {
          type: 'slice:updated',
          slice: msg.slice,
          value: msg.value,
          version: storeState.version,
          serverTime: now,
          sourceClientId,
        },
      };
    }

    case 'batch:set': {
      if (!msg.patches || typeof msg.patches !== 'object') {
        return { ok: false };
      }
      const cleanPatches: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(msg.patches)) {
        if (VALID_SLICES.has(k) && v !== undefined) {
          storeState.data[k] = v;
          cleanPatches[k] = v;
        }
      }
      if (Object.keys(cleanPatches).length === 0) {
        return { ok: true };
      }
      storeState.initialized = true;
      storeState.version += 1;
      scheduleFlush();
      return {
        ok: true,
        broadcastPayload: {
          type: 'batch:updated',
          patches: cleanPatches,
          version: storeState.version,
          serverTime: now,
          sourceClientId,
        },
      };
    }

    case 'item:upsert': {
      if (
        !msg.slice ||
        !VALID_SLICES.has(msg.slice) ||
        !msg.item ||
        typeof msg.item !== 'object' ||
        typeof msg.item.id !== 'string'
      ) {
        return { ok: false };
      }
      const current = Array.isArray(storeState.data[msg.slice])
        ? ([...(storeState.data[msg.slice] as Array<{ id?: string }>)] as Array<{
            id?: string;
          }>)
        : [];
      const idx = current.findIndex((entry) => entry && entry.id === msg.item?.id);
      if (idx >= 0) {
        current[idx] = msg.item;
      } else if (msg.prepend !== false) {
        current.unshift(msg.item);
      } else {
        current.push(msg.item);
      }
      storeState.data[msg.slice] = current;
      storeState.initialized = true;
      storeState.version += 1;
      scheduleFlush();
      return {
        ok: true,
        broadcastPayload: {
          type: 'item:upserted',
          slice: msg.slice,
          item: msg.item,
          prepend: msg.prepend !== false,
          version: storeState.version,
          serverTime: now,
          sourceClientId,
        },
      };
    }

    case 'item:remove': {
      if (!msg.slice || !VALID_SLICES.has(msg.slice) || typeof msg.id !== 'string') {
        return { ok: false };
      }
      const current = Array.isArray(storeState.data[msg.slice])
        ? (storeState.data[msg.slice] as Array<{ id?: string }>)
        : [];
      const next = current.filter((entry) => entry?.id !== msg.id);
      storeState.data[msg.slice] = next;
      storeState.initialized = true;
      storeState.version += 1;
      scheduleFlush();
      return {
        ok: true,
        broadcastPayload: {
          type: 'item:removed',
          slice: msg.slice,
          id: msg.id,
          version: storeState.version,
          serverTime: now,
          sourceClientId,
        },
      };
    }

    case 'alert:push': {
      if (!msg.alert || typeof msg.alert !== 'object' || typeof msg.alert.id !== 'string') {
        return { ok: false };
      }
      const current = Array.isArray(storeState.data.teacherAlerts)
        ? (storeState.data.teacherAlerts as Array<{ id?: string }>)
        : [];
      const alreadyExists = current.some((a) => a?.id === msg.alert?.id);
      const next = alreadyExists
        ? current
        : [msg.alert, ...current].slice(0, 60);
      storeState.data.teacherAlerts = next;
      storeState.initialized = true;
      storeState.version += 1;
      scheduleFlush();
      return {
        ok: true,
        broadcastPayload: {
          type: 'alert:new',
          alert: msg.alert,
          alerts: next,
          version: storeState.version,
          serverTime: now,
          sourceClientId,
        },
      };
    }

    case 'log:append': {
      if (!msg.entry || typeof msg.entry !== 'object' || typeof msg.entry.id !== 'string') {
        return { ok: false };
      }
      const current = Array.isArray(storeState.data.systemLogs)
        ? (storeState.data.systemLogs as Array<{ id?: string }>)
        : [];
      const alreadyExists = current.some((l) => l?.id === msg.entry?.id);
      const next = alreadyExists
        ? current
        : [msg.entry, ...current].slice(0, 500);
      storeState.data.systemLogs = next;
      storeState.initialized = true;
      storeState.version += 1;
      scheduleFlush();
      return {
        ok: true,
        broadcastPayload: {
          type: 'log:new',
          entry: msg.entry,
          logs: next,
          version: storeState.version,
          serverTime: now,
          sourceClientId,
        },
      };
    }

    case 'support:message': {
      const m = msg.message;
      const threadId = typeof msg.threadId === 'string' ? msg.threadId.trim() : '';
      if (
        !threadId ||
        !m ||
        typeof m !== 'object' ||
        typeof m.id !== 'string' ||
        typeof m.text !== 'string' ||
        !m.text.trim()
      ) {
        return { ok: false };
      }

      type ServerSupportMsg = {
        id: string;
        threadId: string;
        senderId: string;
        senderName: string;
        senderRole: string;
        text: string;
        createdAt: string;
      };
      type ServerSupportThread = {
        id: string;
        userId: string;
        userName: string;
        userEmail?: string;
        userRole: string;
        status: 'open' | 'resolved';
        updatedAt: string;
        unreadForAdmin: number;
        unreadForUser: number;
        messages: ServerSupportMsg[];
      };

      const current = Array.isArray(storeState.data.supportChats)
        ? ([...(storeState.data.supportChats as ServerSupportThread[])])
        : [];
      const existingIdx = current.findIndex((t) => t && t.id === threadId);
      const cleanMsg: ServerSupportMsg = {
        id: m.id,
        threadId,
        senderId: typeof m.senderId === 'string' ? m.senderId : 'guest',
        senderName: typeof m.senderName === 'string' ? m.senderName : 'User',
        senderRole: typeof m.senderRole === 'string' ? m.senderRole : 'guest',
        text: m.text.trim(),
        createdAt:
          typeof m.createdAt === 'string' ? m.createdAt : new Date(now).toISOString(),
      };
      const isFromAdmin = cleanMsg.senderRole === 'admin';

      if (existingIdx >= 0) {
        const existing = current[existingIdx];
        const msgs = Array.isArray(existing.messages) ? [...existing.messages] : [];
        if (msgs.some((item) => item?.id === cleanMsg.id)) {
          return { ok: true };
        }
        msgs.push(cleanMsg);
        const updated: ServerSupportThread = {
          ...existing,
          userName: !isFromAdmin && typeof msg.userName === 'string' && msg.userName.trim()
            ? msg.userName.trim()
            : existing.userName,
          userEmail: !isFromAdmin && typeof msg.userEmail === 'string'
            ? msg.userEmail
            : existing.userEmail,
          userRole: !isFromAdmin && typeof msg.userRole === 'string'
            ? msg.userRole
            : existing.userRole,
          status: !isFromAdmin ? 'open' : existing.status,
          updatedAt: cleanMsg.createdAt,
          unreadForAdmin: isFromAdmin
            ? existing.unreadForAdmin
            : (existing.unreadForAdmin || 0) + 1,
          unreadForUser: isFromAdmin
            ? (existing.unreadForUser || 0) + 1
            : existing.unreadForUser,
          messages: msgs.slice(-200),
        };
        current.splice(existingIdx, 1);
        current.unshift(updated);
      } else {
        const createdThread: ServerSupportThread = {
          id: threadId,
          userId: typeof msg.userId === 'string' ? msg.userId : cleanMsg.senderId,
          userName:
            typeof msg.userName === 'string' && msg.userName.trim()
              ? msg.userName.trim()
              : cleanMsg.senderName,
          userEmail: typeof msg.userEmail === 'string' ? msg.userEmail : undefined,
          userRole: typeof msg.userRole === 'string' ? msg.userRole : cleanMsg.senderRole,
          status: 'open',
          updatedAt: cleanMsg.createdAt,
          unreadForAdmin: isFromAdmin ? 0 : 1,
          unreadForUser: isFromAdmin ? 1 : 0,
          messages: [cleanMsg],
        };
        current.unshift(createdThread);
      }

      storeState.data.supportChats = current;
      storeState.initialized = true;
      storeState.version += 1;
      scheduleFlush();
      return {
        ok: true,
        broadcastPayload: {
          type: 'slice:updated',
          slice: 'supportChats',
          value: current,
          version: storeState.version,
          serverTime: now,
          sourceClientId,
        },
      };
    }

    case 'support:mark_read': {
      const threadId = typeof msg.threadId === 'string' ? msg.threadId.trim() : '';
      if (!threadId) return { ok: false };
      const current = Array.isArray(storeState.data.supportChats)
        ? (storeState.data.supportChats as Array<Record<string, unknown>>)
        : [];
      let changed = false;
      const viewerIsAdmin = msg.viewerRole === 'admin';
      const next = current.map((t) => {
        if (!t || t.id !== threadId) return t;
        const field = viewerIsAdmin ? 'unreadForAdmin' : 'unreadForUser';
        if (t[field] === 0) return t;
        changed = true;
        return { ...t, [field]: 0 };
      });
      if (!changed) return { ok: true };
      storeState.data.supportChats = next;
      storeState.initialized = true;
      storeState.version += 1;
      scheduleFlush();
      return {
        ok: true,
        broadcastPayload: {
          type: 'slice:updated',
          slice: 'supportChats',
          value: next,
          version: storeState.version,
          serverTime: now,
          sourceClientId,
        },
      };
    }

    case 'support:thread_status': {
      const threadId = typeof msg.threadId === 'string' ? msg.threadId.trim() : '';
      const status = msg.status === 'resolved' ? 'resolved' : msg.status === 'open' ? 'open' : null;
      if (!threadId || !status) return { ok: false };
      const current = Array.isArray(storeState.data.supportChats)
        ? (storeState.data.supportChats as Array<Record<string, unknown>>)
        : [];
      let changed = false;
      const next = current.map((t) => {
        if (!t || t.id !== threadId || t.status === status) return t;
        changed = true;
        return { ...t, status };
      });
      if (!changed) return { ok: true };
      storeState.data.supportChats = next;
      storeState.initialized = true;
      storeState.version += 1;
      scheduleFlush();
      return {
        ok: true,
        broadcastPayload: {
          type: 'slice:updated',
          slice: 'supportChats',
          value: next,
          version: storeState.version,
          serverTime: now,
          sourceClientId,
        },
      };
    }

    default:
      return { ok: false };
  }
}

async function startServer(): Promise<void> {
  loadStoreFromDisk();

  const app = express();
  app.use(express.json({ limit: '15mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    try {
      const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      if (reqUrl.pathname === '/ws') {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req);
        });
      }
    } catch {
      socket.destroy();
    }
  });

  function broadcastJson(payload: Record<string, unknown>, excludeWs?: WebSocket): void {
    const serialized = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client === excludeWs) continue;
      if (client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    }
  }

  wss.on('connection', (ws) => {
    ws.send(
      JSON.stringify({
        type: 'snapshot',
        reason: 'connect',
        initialized: storeState.initialized,
        version: storeState.version,
        serverTime: Date.now(),
        data: storeState.data,
      }),
    );

    ws.on('message', (raw) => {
      try {
        const text = typeof raw === 'string' ? raw : raw.toString('utf8');
        const msg = JSON.parse(text) as IncomingMutation;
        if (msg.type === 'ping') {
          ws.send(
            JSON.stringify({
              type: 'pong',
              serverTime: Date.now(),
              version: storeState.version,
            }),
          );
          return;
        }
        if (msg.type === 'snapshot:request') {
          ws.send(
            JSON.stringify({
              type: 'snapshot',
              reason: 'sync',
              initialized: storeState.initialized,
              version: storeState.version,
              serverTime: Date.now(),
              data: storeState.data,
            }),
          );
          return;
        }
        const res = applyMutation(msg);
        if (res.broadcastPayload) {
          const isSnapshotAll = res.broadcastPayload.type === 'snapshot';
          broadcastJson(res.broadcastPayload, isSnapshotAll ? undefined : ws);
        }
      } catch (err) {
        console.error('[realtime] WS message error:', err);
      }
    });
  });

  // Periodic server clock sync heartbeat (every 20 seconds)
  const heartbeatInterval = setInterval(() => {
    broadcastJson({
      type: 'heartbeat',
      serverTime: Date.now(),
      version: storeState.version,
    });
  }, 20_000);
  heartbeatInterval.unref();

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      serverTime: Date.now(),
      version: storeState.version,
      initialized: storeState.initialized,
    });
  });

  app.get('/api/realtime/state', (_req, res) => {
    res.json({
      initialized: storeState.initialized,
      version: storeState.version,
      serverTime: Date.now(),
      data: storeState.data,
    });
  });

  app.post('/api/realtime/mutate', (req, res) => {
    const body = req.body as IncomingMutation | undefined;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ ok: false, error: 'Invalid mutation payload' });
      return;
    }
    const result = applyMutation(body);
    if (!result.ok) {
      res.status(400).json({ ok: false, error: 'Unsupported mutation' });
      return;
    }
    if (result.broadcastPayload) {
      broadcastJson(result.broadcastPayload);
    }
    res.json({
      ok: true,
      version: storeState.version,
      serverTime: Date.now(),
    });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    process.env.DISABLE_HMR = 'true';
    const vite = await createViteServer({
      plugins: [
        {
          name: 'disable-hmr-client-ws',
          enforce: 'post',
          transform(code, id) {
            const cleanId = id.split('?')[0].replace(/\\/g, '/');
            if (!cleanId.endsWith('/vite/dist/client/client.mjs')) return null;
            return {
              code: code.replace(
                'transport.connect(createHMRHandler(handleMessage));',
                '/* HMR WebSocket disabled in AI Studio dev environment */',
              ),
              map: null,
            };
          },
        },
      ],
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[realtime] NTPEXION server listening on http://0.0.0.0:${PORT}`);
  });

  const handleShutdown = () => {
    clearInterval(heartbeatInterval);
    flushStoreSync();
    process.exit(0);
  };
  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);
}

void startServer();
