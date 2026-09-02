/**
 * MultiplayerSync — Live Real-Time Multiplayer Movement, Presence, and Speech Synchronization.
 *
 * Supports:
 * - Supabase Realtime Broadcast WebSockets (Vercel Production)
 * - Server-Sent Events (SSE) & REST position relay (Local Development & Express)
 */

import { supabase } from '../api/supabase.js';

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
  private supabaseChannel: any = null;
  private onRemotePlayerMove: (data: LivePlayerPayload) => void;

  private isSupabaseSubscribed = false;
  private lastSentWx = -9999;
  private lastSentWy = -9999;
  private lastSentState = '';
  private lastSentDirection = '';
  private lastSentSpeech: string | null = null;
  private lastSendTime = 0;

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
    // 1. Try Supabase Realtime Channel (Production WebSockets)
    if (supabase) {
      try {
        const channel = supabase.channel('spot-world-multiplayer', {
          config: { broadcast: { self: false } },
        });

        channel
          .on('broadcast', { event: 'player-position' }, (event: any) => {
            const payload = event?.payload;
            if (payload && payload.senderTabId !== this.tabId) {
              this.onRemotePlayerMove(payload);
            }
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              this.isSupabaseSubscribed = true;
            } else {
              this.isSupabaseSubscribed = false;
            }
          });

        this.supabaseChannel = channel;
      } catch (err) {
        console.warn('[MultiplayerSync] Supabase channel initialization notice:', err);
      }
    }

    // 2. Also connect SSE Stream (for local Express server & instant dev events)
    const apiSseEnabled = (import.meta as any).env?.DEV || (import.meta as any).env?.PUBLIC_ENABLE_SSE === 'true';
    if (this.apiBase && apiSseEnabled) {
      const streamUrl = `${this.apiBase}/api/realtime/stream?tabId=${this.tabId}`;
      try {
        const source = new EventSource(streamUrl, { withCredentials: true });
        this.sseSource = source;

        source.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'player-position' && data.senderTabId !== this.tabId) {
              this.onRemotePlayerMove(data);
            }
          } catch (_) {}
        };
      } catch (_) {}
    }
  }

  stop(): void {
    if (this.supabaseChannel && supabase) {
      try {
        supabase.removeChannel(this.supabaseChannel);
      } catch (_) {}
      this.supabaseChannel = null;
    }
    if (this.sseSource) {
      this.sseSource.close();
      this.sseSource = null;
    }
  }

  private getCurrentId(): string {
    return this.myCitizenId || this.guestId;
  }

  /**
   * Throttled position & speech broadcast (sends every 150ms when moving or talking).
   */
  broadcastMovement(
    wx: number,
    wy: number,
    direction: 'down' | 'up' | 'left' | 'right',
    state: string,
    speech?: string | null,
  ): void {
    const now = Date.now();
    const distMoved = Math.hypot(wx - this.lastSentWx, wy - this.lastSentWy);
    const stateChanged = state !== this.lastSentState || direction !== this.lastSentDirection;
    const speechChanged = speech !== this.lastSentSpeech;

    // Throttle: send if moved > 2px, or state/speech changed, or 2s keepalive
    if (distMoved < 2.5 && !stateChanged && !speechChanged && now - this.lastSendTime < 2000) {
      return;
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

    // Broadcast via Supabase WebSockets (Free, Instant, 0 Vercel Invocations)
    if (this.supabaseChannel && this.isSupabaseSubscribed) {
      try {
        this.supabaseChannel.send({
          type: 'broadcast',
          event: 'player-position',
          payload,
        });
      } catch (_) {}
      return;
    }

    // Local dev fallback only (never hammer Vercel serverless in production)
    if (import.meta.env.DEV) {
      try {
        fetch(`${this.apiBase}/api/realtime/position`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        }).catch(() => {});
      } catch (_) {}
    }
  }
}
