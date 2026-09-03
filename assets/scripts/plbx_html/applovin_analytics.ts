/**
 * AppLovin Axon playable-analytics helper.
 *
 * Sends events through window.ALPlayableAnalytics.trackEvent(). The SDK injects
 * that global itself; we never define it (see APPLOVIN_AXON_ANALYTICS.md).
 *
 * Call sites live in Core/Playbox.ts only — the game code never imports this
 * module directly, so the whole network-SDK surface stays in one place
 * (ARCHITECTURE.md §6).
 *
 * Reference:
 * https://support.axon.ai/en/growth/promoting-your-apps/creatives/playable-analytics-integration
 */

export enum AppLovinEvent {
  LOADING = 'LOADING',
  LOADED = 'LOADED',
  DISPLAYED = 'DISPLAYED',
  CHALLENGE_STARTED = 'CHALLENGE_STARTED',
  CHALLENGE_PASS_25 = 'CHALLENGE_PASS_25',
  CHALLENGE_PASS_50 = 'CHALLENGE_PASS_50',
  CHALLENGE_PASS_75 = 'CHALLENGE_PASS_75',
  CHALLENGE_FAILED = 'CHALLENGE_FAILED',
  CHALLENGE_RETRY = 'CHALLENGE_RETRY',
  CHALLENGE_SOLVED = 'CHALLENGE_SOLVED',
  ENDCARD_SHOWN = 'ENDCARD_SHOWN',
  CTA_CLICKED = 'CTA_CLICKED',
}

interface ALPlayableAnalyticsApi {
  trackEvent(eventName: string): void;
}

/** Events the spec requires to be fired at most once per session. */
const FIRE_ONCE: ReadonlySet<AppLovinEvent> = new Set([
  AppLovinEvent.LOADING,
  AppLovinEvent.LOADED,
  AppLovinEvent.DISPLAYED,
  AppLovinEvent.CHALLENGE_STARTED,
  AppLovinEvent.ENDCARD_SHOWN,
  AppLovinEvent.CTA_CLICKED,
]);

/**
 * Literal-argument senders, one per event the game actually fires.
 *
 * Needed because the package-time gate statically scans the built JS for calls
 * whose argument is a spec-name string *literal*: a lone dynamic call site
 * (argument passed as a variable) would leave the scan seeing zero events even
 * though the runtime fires them correctly. Anything absent here still goes out
 * through the dynamic fallback in `dispatch()` — it just stays invisible to the
 * static scan. Keep event-name literals out of comments in this file, too: a
 * debug build keeps comments, and the scan would read them as custom names,
 * which it rejects at error level.
 *
 * CHALLENGE_* deliberately omitted: blocked on OPEN_ISSUES.md #8 (the 1cl/xcl
 * classification of this creative is unconfirmed, and 1cl playables must not
 * fire them). Add an entry here together with the Playbox.ts call site once the
 * status lands.
 */
const LITERAL_SENDERS: Partial<Record<AppLovinEvent, (api: ALPlayableAnalyticsApi) => void>> = {
  [AppLovinEvent.DISPLAYED]: (api) => api.trackEvent('DISPLAYED'),
  [AppLovinEvent.ENDCARD_SHOWN]: (api) => api.trackEvent('ENDCARD_SHOWN'),
  [AppLovinEvent.CTA_CLICKED]: (api) => api.trackEvent('CTA_CLICKED'),
};

/** Minimum gap between two events — AppLovin rejects simultaneous sends (spec: >= 50 ms). */
const MIN_SPACING_MS = 75;

/** The SDK global can appear a tick after the creative starts; poll for it this often... */
const SDK_POLL_MS = 250;

/** ...but give up after this, so non-AppLovin networks don't retry forever. */
const SDK_WAIT_TIMEOUT_MS = 5000;

function resolveApi(): ALPlayableAnalyticsApi | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const api = (window as unknown as { ALPlayableAnalytics?: ALPlayableAnalyticsApi })
    .ALPlayableAnalytics;
  return api && typeof api.trackEvent === 'function' ? api : null;
}

class AppLovinAnalyticsManager {
  private readonly sentEvents: Set<AppLovinEvent> = new Set();
  private readonly eventQueue: AppLovinEvent[] = [];
  private isPumpScheduled: boolean = false;
  private lastSentAtMs: number = 0;
  private firstAttemptAtMs: number = 0;

  /**
   * Queue an event. Fire-once events are dropped on repeat calls; the rest
   * (the CHALLENGE_PASS / FAILED / RETRY family) may legitimately repeat when
   * the player retries.
   */
  public send(eventName: AppLovinEvent): void {
    if (FIRE_ONCE.has(eventName) && this.isSent(eventName)) {
      return;
    }
    if (this.firstAttemptAtMs === 0) {
      this.firstAttemptAtMs = Date.now();
    }
    this.eventQueue.push(eventName);
    this.schedulePump(this.spacingDelayMs());
  }

  /** True once the event has been handed to the SDK, or while it waits in the queue. */
  public isSent(eventName: AppLovinEvent): boolean {
    return this.sentEvents.has(eventName) || this.eventQueue.indexOf(eventName) !== -1;
  }

  private spacingDelayMs(): number {
    if (this.lastSentAtMs === 0) {
      return 0;
    }
    return Math.max(0, MIN_SPACING_MS - (Date.now() - this.lastSentAtMs));
  }

  private schedulePump(delayMs: number): void {
    if (this.isPumpScheduled || this.eventQueue.length === 0) {
      return;
    }
    this.isPumpScheduled = true;
    setTimeout(() => {
      this.isPumpScheduled = false;
      this.pump();
    }, delayMs);
  }

  // Drains the queue one event per tick, preserving call order (the spec grades
  // lifecycle order by first fire) and the minimum spacing between sends.
  private pump(): void {
    const eventName = this.eventQueue[0];
    if (eventName === undefined) {
      return;
    }

    const api = resolveApi();
    if (!api) {
      if (Date.now() - this.firstAttemptAtMs < SDK_WAIT_TIMEOUT_MS) {
        // Keep the event queued rather than marking it sent — losing DISPLAYED
        // to a late SDK injection is exactly what the validator would flag.
        this.schedulePump(SDK_POLL_MS);
        return;
      }
      // No SDK: another network, or local preview without the mock. Stop quietly.
      this.eventQueue.length = 0;
      return;
    }

    this.eventQueue.shift();
    this.sentEvents.add(eventName);
    this.lastSentAtMs = Date.now();
    this.dispatch(api, eventName);
    this.schedulePump(MIN_SPACING_MS);
  }

  private dispatch(api: ALPlayableAnalyticsApi, eventName: AppLovinEvent): void {
    try {
      const literalSender = LITERAL_SENDERS[eventName];
      if (literalSender) {
        literalSender(api);
      } else {
        api.trackEvent(eventName);
      }
      console.log(`[AppLovin] ${eventName}`);
    } catch (e) {
      // Never let an SDK error reach gameplay.
      console.log(`[AppLovin] ${eventName} failed: ${e}`);
    }
  }

  public reset(): void {
    this.sentEvents.clear();
    this.eventQueue.length = 0;
    this.isPumpScheduled = false;
    this.lastSentAtMs = 0;
    this.firstAttemptAtMs = 0;
  }
}

export const applovinAnalytics = new AppLovinAnalyticsManager();
