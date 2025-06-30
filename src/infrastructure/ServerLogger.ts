// ServerLogger.ts
// Server-side logging for direct file writing to project directory

export class ServerLogger {
  private static endpoint = '/api/log'; // Will be handled by Vite dev server or custom server
  private static sessionId = Date.now().toString(36);
  private static buffer: any[] = [];
  private static isEnabled = false;

  static async initialize(): Promise<boolean> {
    try {
      // Test if logging endpoint is available
      const response = await fetch(this.endpoint + '/test', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      this.isEnabled = response.ok;
      if (this.isEnabled) {
        // Initialization log, visible by default
        import('./DebugLogger').then(({ DebugLogger }) => {
          DebugLogger.log('system-event', '[ServerLogger] Initialized - logs will be written to debug/ folder', {});
        });
      } else {
        import('./DebugLogger').then(({ DebugLogger }) => {
          DebugLogger.log('system-event', '[ServerLogger] Endpoint not available - falling back to browser downloads', {});
        });
      }
      return this.isEnabled;
    } catch (error) {
      import('./DebugLogger').then(({ DebugLogger }) => {
        DebugLogger.log('system-event', '[ServerLogger] Server logging not available - using browser downloads', { error });
      });
      this.isEnabled = false;
      return false;
    }
  }

  static async writeLog(type: string, data: any): Promise<boolean> {
    if (!this.isEnabled) return false;

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          timestamp: Date.now(),
          type,
          data
        })
      });

      return response.ok;
    } catch (error) {
      console.error('[ServerLogger] Failed to write log:', error);
      return false;
    }
  }

  static isAvailable(): boolean {
    return this.isEnabled;
  }
}
