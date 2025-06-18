// DebugLogger.ts
// Centralized, summarized debug logger for simulation explosions/instabilities

export type DebugLogType = 'spring' | 'gravity' | 'pointmass';

interface DebugLogEntry {
  type: DebugLogType;
  message: string;
  data: any;
  timestamp: number;
  critical?: boolean; // Mark if this is a critical error
}

export type DebugCriticalErrorListener = (entry: DebugLogEntry) => void;

export class DebugLogger {
  private static logs: DebugLogEntry[] = [];
  private static lastFlush = 0;
  private static FLUSH_INTERVAL = 1000; // ms
  private static MAX_LOGS = 100;
  private static lastMessages: Record<string, number> = {};
  private static DEDUP_WINDOW = 2000; // ms
  private static SIGNIFICANT_THRESHOLDS: Record<DebugLogType, number> = {
    spring: 1e5,
    gravity: 1e4,
    pointmass: 1e6
  };
  private static criticalListeners: DebugCriticalErrorListener[] = [];
  static isCrashed: boolean = false;

  static addCriticalErrorListener(listener: DebugCriticalErrorListener) {
    this.criticalListeners.push(listener);
  }

  static log(type: DebugLogType, message: string, data: any) {
    if (this.isCrashed) return;
    // Only log if a value is truly significant
    const threshold = this.SIGNIFICANT_THRESHOLDS[type] || 1e6;
    let isSignificant = false;
    let isCritical = false;
    if (type === 'spring') {
      isSignificant = Math.abs(data.forceMag) > threshold || Math.abs(data.dampingForce) > threshold || Math.abs(data.fx) > threshold || Math.abs(data.fy) > threshold;
      isCritical = !isFinite(data.forceMag) || !isFinite(data.dampingForce) || !isFinite(data.fx) || !isFinite(data.fy) || Math.abs(data.forceMag) > threshold * 100;
    } else if (type === 'gravity') {
      isSignificant = Math.abs(data.fx) > threshold || Math.abs(data.fy) > threshold;
      isCritical = !isFinite(data.fx) || !isFinite(data.fy) || Math.abs(data.fx) > threshold * 100;
    } else if (type === 'pointmass') {
      isSignificant = !isFinite(data.position?.x) || !isFinite(data.position?.y) || !isFinite(data.velocity?.x) || !isFinite(data.velocity?.y) ||
        Math.abs(data.position?.x) > threshold || Math.abs(data.position?.y) > threshold || Math.abs(data.velocity?.x) > threshold || Math.abs(data.velocity?.y) > threshold;
      isCritical = !isFinite(data.position?.x) || !isFinite(data.position?.y) || !isFinite(data.velocity?.x) || !isFinite(data.velocity?.y) ||
        Math.abs(data.position?.x) > threshold * 100 || Math.abs(data.position?.y) > threshold * 100 || Math.abs(data.velocity?.x) > threshold * 100 || Math.abs(data.velocity?.y) > threshold * 100;
    }
    if (!isSignificant) return;
    // Deduplicate similar messages within a short window
    const key = type + ':' + message;
    const now = Date.now();
    if (this.lastMessages[key] && now - this.lastMessages[key] < this.DEDUP_WINDOW) return;
    this.lastMessages[key] = now;
    const entry: DebugLogEntry = { type, message, data, timestamp: now, critical: isCritical };
    this.logs.push(entry);
    if (isCritical) {
      this.isCrashed = true;
      // Notify all listeners of a critical error
      for (const listener of this.criticalListeners) {
        try { listener(entry); } catch (e) { /* ignore */ }
      }
    }
    this.flush();
  }

  static flush() {
    if (this.isCrashed) return;
    if (this.logs.length === 0) return;
    const summary = this.logs.reduce((acc, entry) => {
      acc[entry.type] = (acc[entry.type] || 0) + 1;
      return acc;
    }, {} as Record<DebugLogType, number>);
    console.warn('[DebugLogger][Summary]', summary, 'Sample:', this.logs[0]);
    this.logs = [];
    this.lastFlush = Date.now();
  }
}
