// DebugLogger.ts
// Centralized, summarized debug logger for simulation explosions/instabilities
// Enhanced with file output for real-world feedback analysis

export type DebugLogType = 'spring' | 'gravity' | 'pointmass' | 'force-coordination' | 'user-interaction' | 'performance' | 'system-event';

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
    pointmass: 1e2,   // 100
    'force-coordination': 1e2, // 100
    'user-interaction': 0,     // Always log user interactions
    'performance': 0,          // Always log performance metrics
    'system-event': 0          // Always log system events
  };
  private static criticalListeners: DebugCriticalErrorListener[] = [];
  static isCrashed: boolean = false;
  static logLevel: 'off' | 'error' | 'warn' | 'info' | 'debug' = 'warn';
  static categoryFilter: DebugLogType[] | null = null; // null = all
  static enableFileOutput: boolean = true; // Enable file output for real-world feedback
  private static sessionId: string = Date.now().toString(36) + '_' + Math.random().toString(36).substring(2);
  private static persistentLogs: DebugLogEntry[] = []; // Accumulate all logs for single file export
  private static hasExportedOnce: boolean = false;
  private static serverLoggingAvailable: boolean = false;

  static setLevel(level: 'off' | 'error' | 'warn' | 'info' | 'debug') {
    this.logLevel = level;
  }
  static setCategoryFilter(categories: DebugLogType[] | null) {
    this.categoryFilter = categories;
  }

  static enableFileLogging(enabled: boolean = true) {
    this.enableFileOutput = enabled;
    if (enabled) {
      console.log(`[DebugLogger] File output enabled for session: ${this.sessionId}`);
    }
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
    } else if (type === 'user-interaction' || type === 'performance' || type === 'system-event') {
      // Always log these types for real-world feedback
      isSignificant = true;
      isCritical = false;
    }
    if (!isSignificant && this.logLevel !== 'debug') return;
    // Deduplicate similar messages within a short window
    const key = type + ':' + message;
    const now = Date.now();
    if (this.lastMessages[key] && now - this.lastMessages[key] < this.DEDUP_WINDOW) return;
    this.lastMessages[key] = now;
    const entry: DebugLogEntry = { type, message, data, timestamp: now, critical: isCritical };
    this.logs.push(entry);
    
    // Also add to persistent logs for file export
    if (this.enableFileOutput) {
      this.persistentLogs.push(entry);
    }
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

  // Write logs to downloadable file for real-world feedback analysis
  private static writeToFile() {
    if (!this.enableFileOutput || this.persistentLogs.length === 0) return;
    if (this.hasExportedOnce) return; // Prevent multiple downloads

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `physics_debug_${this.sessionId}_${timestamp}.json`;
      
      const content = JSON.stringify({
        sessionId: this.sessionId,
        timestamp: Date.now(),
        logLevel: this.logLevel,
        totalEntries: this.persistentLogs.length,
        logs: this.persistentLogs
      }, null, 2);

      // Create downloadable file in browser (only once per session)
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Auto-download the file
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.hasExportedOnce = true;
        console.log(`[DebugLogger] Downloaded ${filename} with ${this.persistentLogs.length} log entries`);
      }
    } catch (error) {
      console.error('[DebugLogger] Failed to write file:', error);
    }
  }

  // Force export all accumulated logs to file
  static exportToFile() {
    this.hasExportedOnce = false; // Reset to allow manual export
    this.writeToFile();
  }

  // Get current log count for monitoring
  static getLogCount(): number {
    return this.persistentLogs.length;
  }

  // Show current logging status
  static showStatus() {
    console.log(`[DebugLogger] Session: ${this.sessionId}`);
    console.log(`[DebugLogger] Persistent logs: ${this.persistentLogs.length}`);
    console.log(`[DebugLogger] Recent logs: ${this.logs.length}`);
    console.log(`[DebugLogger] File output: ${this.enableFileOutput ? 'enabled' : 'disabled'}`);
    console.log(`[DebugLogger] Log level: ${this.logLevel}`);
    console.log(`[DebugLogger] Has exported: ${this.hasExportedOnce}`);
  }

  // Initialize logging for browser environment
  static initializeBrowserLogging() {
    // Check if Vite dev server logging is available
    this.checkServerLogging();
    
    // CONSOLE INTERCEPTION: Capture all console output
    this.interceptConsoleOutput();
    
    // Make debug functions available globally IMMEDIATELY
    if (typeof window !== 'undefined') {
      (window as any).debugLogger = {
        export: () => this.exportLogs(),
        status: () => this.showStatus(),
        clear: () => {
          this.persistentLogs = [];
          this.logs = [];
          console.log('[DebugLogger] Logs cleared');
        },
        serverAvailable: () => this.serverLoggingAvailable,
        test: () => {
          console.log('DebugLogger is working!');
          return 'DebugLogger is available';
        }
      };
      
      console.log('[DebugLogger] debugLogger is now available globally');
      
      // Auto-export logs when the page is about to unload
      window.addEventListener('beforeunload', () => {
        if (this.persistentLogs.length > 0 && !this.hasExportedOnce) {
          this.exportLogs();
        }
      });
    }
  }

  // Check if server logging is available
  static async checkServerLogging() {
    try {
      const response = await fetch('/api/log/test');
      this.serverLoggingAvailable = response.ok;
      const method = this.serverLoggingAvailable ? 'server (debug/ folder)' : 'browser downloads';
      console.log(`[DebugLogger] Using ${method} for log export`);
    } catch (error) {
      this.serverLoggingAvailable = false;
      console.log('[DebugLogger] Using browser downloads for log export');
    }
  }

  // Smart export that tries server first, then falls back to browser download
  static async exportLogs() {
    if (this.serverLoggingAvailable) {
      return this.exportToServer();
    } else {
      return this.exportToFile();
    }
  }

  // Export to server-side file using Vite plugin
  static async exportToServer() {
    if (!this.serverLoggingAvailable || this.persistentLogs.length === 0) {
      console.log('[DebugLogger] Server logging not available, falling back to browser download');
      return this.exportToFile();
    }

    try {
      const logData = {
        sessionId: this.sessionId,
        timestamp: Date.now(),
        logLevel: this.logLevel,
        totalEntries: this.persistentLogs.length,
        logs: this.persistentLogs
      };

      const response = await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData)
      });

      if (response.ok) {
        const result = await response.json();
        this.hasExportedOnce = true;
        console.log(`[DebugLogger] Exported ${this.persistentLogs.length} logs to debug/${result.file}`);
      } else {
        console.log('[DebugLogger] Server export failed, falling back to browser download');
        this.exportToFile();
      }
    } catch (error) {
      console.error('[DebugLogger] Server export error:', error);
      this.exportToFile();
    }
  }

  // Intercept all console output and route to DebugLogger
  private static originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug
  };
  
  static interceptConsoleOutput() {
    // Store original console methods
    const original = this.originalConsole;
    
    // Override console.log
    console.log = (...args: any[]) => {
      original.log(...args);
      this.captureConsoleOutput('log', args);
    };
    
    // Override console.warn
    console.warn = (...args: any[]) => {
      original.warn(...args);
      this.captureConsoleOutput('warn', args);
    };
    
    // Override console.error
    console.error = (...args: any[]) => {
      original.error(...args);
      this.captureConsoleOutput('error', args);
    };
    
    // Override console.info
    console.info = (...args: any[]) => {
      original.info(...args);
      this.captureConsoleOutput('info', args);
    };
    
    // Override console.debug
    console.debug = (...args: any[]) => {
      original.debug(...args);
      this.captureConsoleOutput('debug', args);
    };
    
    console.log('[DebugLogger] Console output interception enabled');
  }
  
  private static captureConsoleOutput(level: string, args: any[]) {
    // Skip our own debug logger messages to avoid infinite loops
    const message = args.join(' ');
    if (message.includes('[DebugLogger]') || message.includes('[ConsoleLogger]')) {
      return;
    }
    
    // Convert console output to DebugLogger format
    const entry: DebugLogEntry = {
      type: 'system-event',
      message: `Console ${level}: ${message}`,
      data: {
        level,
        args: args.map(arg => {
          // Safely serialize objects
          try {
            return typeof arg === 'object' ? JSON.parse(JSON.stringify(arg)) : arg;
          } catch {
            return String(arg);
          }
        }),
        timestamp: Date.now()
      },
      timestamp: Date.now(),
      critical: level === 'error'
    };
    
    // Add to persistent logs only (avoid triggering more console output)
    if (this.enableFileOutput) {
      this.persistentLogs.push(entry);
    }
  }

  static flush() {
    if (this.isCrashed) return;
    if (this.logs.length === 0) return;
    
    // Try server logging first, fall back to browser download
    if (this.enableFileOutput && (this.persistentLogs.length > 100 || this.logs.some(l => l.critical))) {
      this.exportLogs();
    }
    
    const summary = this.logs.reduce((acc, entry) => {
      acc[entry.type] = (acc[entry.type] || 0) + 1;
      return acc;
    }, {} as Record<DebugLogType, number>);
    // Only log summary if logLevel is warn/info/debug
    if (this.logLevel === 'warn' || this.logLevel === 'info' || this.logLevel === 'debug') {
      const lastEntry = this.logs[this.logs.length - 1];
      console.warn('[DebugLogger][Summary]', summary, 'Last:', lastEntry, `Total persistent: ${this.persistentLogs.length}`);
    }
    this.logs = [];
    this.lastFlush = Date.now();
  }
}
