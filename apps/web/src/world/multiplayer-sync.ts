/**
 * MultiplayerSync — Live Real-Time Multiplayer Movement, Presence, and Speech Synchronization.
 *
 * Supports:
 * - Authoritative Backend SSE & REST position relay
 * - Optional Supabase Realtime Broadcast WebSockets
 */

export interface LivePlayerPayload {
  citizenId: string;
  senderTabId: string;
  displayName: string;
  avatarId: string;
  wx: number;
  wy: number;
  direction: 'down' | 'up' | 'left' | 'right';
  state: string;
  speech?: string | null;
  timestamp?: number;
}

export class MultiplayerSync {
  private apiBase: string;
  private myCitizenId: string;
  private myDisplayName: string;
  private myAvatarId: string;
  private guestId: string;
  private tabId: string;

  private sseSource: EventSource | null = null;
  private onRemotePlayerMove: (data: LivePlayerPayload) => void;

  private lastSentWx = -9999;
  private lastSentWy = -9999;
  private lastSentState = '';
  private lastSentDirection = '';
  private lastSentSpeech: string | null = null;
  private lastSendTime = 0;
  private failureCount = 0;
  private networkBackoffUntil = 0;
  private isSending = false;
  private readonly MIN_MOVE_INTERVAL_MS = 140;

  constructor(options: {
    apiBase: string;
    citizenId: string;
    displayName: string;
    avatarId: string;
    onRemotePlayerMove: (data: LivePlayerPayload) => void;
  }) {
    this.apiBase = options.apiBase;
    this.myCitizenId = options.citizenId;
    this.myDisplayName = options.displayName;
    this.myAvatarId = options.avatarId;
    this.onRemotePlayerMove = options.onRemotePlayerMove;
    this.tabId = `tab_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;

    try {
      let savedGuest = sessionStorage.getItem('spot_guest_id');
      if (!savedGuest) {
        savedGuest = `guest_${Math.random().toString(36).slice(2, 8)}`;
        sessionStorage.setItem('spot_guest_id', savedGuest);
      }
      this.guestId = savedGuest;
    } catch {
      this.guestId = `guest_${Math.random().toString(36).slice(2, 8)}`;
    }
  }

  start(): void {
    // Connect authoritative Server-Sent Events stream for real-time multiplayer
    const base = this.getResolvedApiBase();
    if (base) {
      const streamUrl = `${base}/api/realtime/stream?tabId=${this.tabId}`;
      try {
        const source = new EventSource(streamUrl, { withCredentials: true });
        this.sseSource = source;

        source.onopen = () => {
          this.failureCount = 0;
        };

        source.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'player-position' && data.senderTabId !== this.tabId) {
              this.onRemotePlayerMove(data);
            }
          } catch (_) {}
        };

        source.onerror = () => {
          // EventSource auto-retries internally; avoid aggressive console noise
        };
      } catch (_) {}
    }
  }

  stop(): void {
    if (this.sseSource) {
      this.sseSource.close();
      this.sseSource = null;
    }
  }

  private getResolvedApiBase(): string {
    let base = this.apiBase;
    if (typeof window !== 'undefined') {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      // When accessed from non-localhost (e.g. claimyourspot.lol), never use localhost
      if (!isLocal && base && (base.includes('localhost') || base.includes('127.0.0.1'))) {
        return window.location.origin;
      }
      return base || window.location.origin;
    }
    return base || '';
  }

  private handleSendFailure(now: number): void {
    this.failureCount++;
    if (this.failureCount >= 3) {
      // Exponential backoff up to 10s if the server is unreachable
      const backoffMs = Math.min(10000, 1000 * Math.pow(2, this.failureCount - 3));
      this.networkBackoffUntil = now + backoffMs;
    }
  }

  private getCurrentId(): string {
    return this.myCitizenId || this.guestId;
  }

  /**
   * Throttled position & speech broadcast (sends at most ~7/sec when moving, 0 when idle).
   */
  broadcastMovement(
    wx: number,
    wy: number,
    direction: 'down' | 'up' | 'left' | 'right',
    state: string,
    speech?: string | null,
  ): void {
    // Never broadcast when browser tab is inactive/hidden
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }

    const now = Date.now();
    const distMoved = Math.hypot(wx - this.lastSentWx, wy - this.lastSentWy);
    const stateChanged = state !== this.lastSentState || direction !== this.lastSentDirection;
    const speechChanged = speech !== this.lastSentSpeech;
    const isMoving = state === 'walk' || state === 'run' || distMoved >= 2.0;

    // 1. When actively moving: enforce 140ms minimum interval and no overlapping requests
    if (isMoving) {
      if (!speechChanged) {
        if (now - this.lastSendTime < this.MIN_MOVE_INTERVAL_MS || this.isSending) {
          return;
        }
      }
    } else {
      // 2. When stopped/idle: only broadcast once when transitioning to idle (so others see us stop), or when chat speech changes
      if (!stateChanged && !speechChanged) {
        // Idle keepalive: at most once every 30 seconds
        if (now - this.lastSendTime < 30000) {
          return;
        }
      }
    }

    this.lastSentWx = wx;
    this.lastSentWy = wy;
    this.lastSentDirection = direction;
    this.lastSentState = state;
    this.lastSentSpeech = speech || null;
    this.lastSendTime = now;

    const payload: LivePlayerPayload = {
      citizenId: this.getCurrentId(),
      senderTabId: this.tabId,
      displayName: this.myDisplayName || 'Visitor',
      avatarId: this.myAvatarId || 'astronaut',
      wx: Math.round(wx * 10) / 10,
      wy: Math.round(wy * 10) / 10,
      direction,
      state,
      speech: speech || null,
      timestamp: now,
    };

    // Broadcast via Authoritative Backend (SSE)
    const base = this.getResolvedApiBase();
    if (base && now >= this.networkBackoffUntil) {
      this.isSending = true;
      try {
        fetch(`${base}/api/realtime/position`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        })
          .then((res) => {
            this.isSending = false;
            if (res.ok) {
              this.failureCount = 0;
            } else {
              this.handleSendFailure(Date.now());
            }
          })
          .catch(() => {
            this.isSending = false;
            this.handleSendFailure(Date.now());
          });
      } catch (_) {
        this.isSending = false;
      }
    }
  }
}
