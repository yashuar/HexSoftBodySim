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
  // Lowered thresholds for more aggressive anomaly logging
  private static SIGNIFICANT_THRESHOLDS: Record<DebugLogType, number> = {
    spring: 1e2,      // 100
    gravity: 1e2,     // 100
    pointmass: 1e2    // 100
  };
  private static criticalListeners: DebugCriticalErrorListener[] = [];
  static isCrashed: boolean = false;
  static logLevel: 'off' | 'error' | 'warn' | 'info' | 'debug' = 'warn';
  static categoryFilter: DebugLogType[] | null = null; // null = all

  static setLevel(level: 'off' | 'error' | 'warn' | 'info' | 'debug') {
    this.logLevel = level;
  }
  static setCategoryFilter(categories: DebugLogType[] | null) {
    this.categoryFilter = categories;
  }

  static addCriticalErrorListener(listener: DebugCriticalErrorListener) {
    this.criticalListeners.push(listener);
  }

  static log(type: DebugLogType, message: string, data: any) {
    if (this.isCrashed) return;
    if (this.categoryFilter && !this.categoryFilter.includes(type)) return;
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
    if (!isSignificant && this.logLevel !== 'debug') return;
    // Deduplicate similar messages within a short window
    const key = type + ':' + message;
    const now = Date.now();
    if (this.lastMessages[key] && now - this.lastMessages[key] < this.DEDUP_WINDOW) return;
    this.lastMessages[key] = now;
    const entry: DebugLogEntry = { type, message, data, timestamp: now, critical: isCritical };
    this.logs.push(entry);
    if (isCritical || this.logLevel === 'error') {
      this.isCrashed = true;
      // Notify all listeners of a critical error
      for (const listener of this.criticalListeners) {
        try { listener(entry); } catch (e) { /* ignore */ }
      }
      // Always log critical errors immediately
      console.error('[DebugLogger][CRITICAL]', entry, new Error().stack);
      this.logs = [];
      return;
    }
    // Throttle flushes to at most once per second
    if (now - this.lastFlush > this.FLUSH_INTERVAL || this.logs.length > this.MAX_LOGS) {
      this.flush();
    }
  }

  static flush() {
    if (this.isCrashed) return;
    if (this.logs.length === 0) return;
    const summary = this.logs.reduce((acc, entry) => {
      acc[entry.type] = (acc[entry.type] || 0) + 1;
      return acc;
    }, {} as Record<DebugLogType, number>);
    // Only log summary if logLevel is warn/info/debug
    if (this.logLevel === 'warn' || this.logLevel === 'info' || this.logLevel === 'debug') {
      const lastEntry = this.logs[this.logs.length - 1];
      console.warn('[DebugLogger][Summary]', summary, 'Last:', lastEntry);
    }
    this.logs = [];
    this.lastFlush = Date.now();
  }
}
