/**
 * AppLovin analytics helper for playable ads.
 *
 * Sends events through window.ALPlayableAnalytics.trackEvent() when available.
 * Each event is deduplicated and sent at most once.
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

class AppLovinAnalyticsManager {
  private readonly sentEvents: Set<string> = new Set();
  private readonly queuedEvents: Set<string> = new Set();
  private readonly eventQueue: AppLovinEvent[] = [];
  private isDrainingQueue: boolean = false;
  private lastSentAtMs: number = 0;
  private readonly minEventSpacingMs: number = 75;

  public send(eventName: AppLovinEvent): void {
    if (this.sentEvents.has(eventName) || this.queuedEvents.has(eventName)) {
      return;
    }

    this.queuedEvents.add(eventName);
    this.eventQueue.push(eventName);
    this.drainQueue();
  }

  private drainQueue(): void {
    if (this.isDrainingQueue || this.eventQueue.length === 0) {
      return;
    }

    this.isDrainingQueue = true;
    const elapsedMs = Date.now() - this.lastSentAtMs;
    const delayMs = this.lastSentAtMs === 0
      ? 0
      : Math.max(0, this.minEventSpacingMs - elapsedMs);

    setTimeout(() => {
      const eventName = this.eventQueue.shift();
      if (eventName) {
        this.sendNow(eventName);
      }

      this.isDrainingQueue = false;
      this.drainQueue();
    }, delayMs);
  }

  private sendNow(eventName: AppLovinEvent): void {
    this.queuedEvents.delete(eventName);
    this.sentEvents.add(eventName);
    this.lastSentAtMs = Date.now();

    try {
      // @ts-ignore AppLovin injects this object in production.
      if (typeof window !== 'undefined' && typeof window.ALPlayableAnalytics !== 'undefined') {
        // @ts-ignore AppLovin SDK runtime API.
        window.ALPlayableAnalytics.trackEvent(eventName);
      }
    } catch {
      // Ignore analytics errors during local testing or on other networks.
    }

    console.log(`[AppLovin] Event sent: ${eventName}`);
  }

  public isSent(eventName: AppLovinEvent): boolean {
    return this.sentEvents.has(eventName) || this.queuedEvents.has(eventName);
  }

  public reset(): void {
    this.sentEvents.clear();
    this.queuedEvents.clear();
    this.eventQueue.length = 0;
    this.isDrainingQueue = false;
    this.lastSentAtMs = 0;
  }
}

export const applovinAnalytics = new AppLovinAnalyticsManager();
