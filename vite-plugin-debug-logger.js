// vite-plugin-debug-logger.js
// Vite plugin to handle debug log file writing during development
// Enhanced to capture ALL console output, not just DebugLogger calls

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

export function debugLoggerPlugin() {
  return {
    name: 'debug-logger',
    configureServer(server) {
      // Add API endpoint for logging
      server.middlewares.use('/api/log', (req, res, next) => {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }
        
        if (req.method === 'GET' && req.url.endsWith('/test')) {
          // Test endpoint
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', message: 'Debug logging available' }));
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          
          req.on('end', () => {
            try {
              const logData = JSON.parse(body);
              const debugDir = join(process.cwd(), 'debug');
              
              // Create debug directory if it doesn't exist
              if (!existsSync(debugDir)) {
                mkdirSync(debugDir, { recursive: true });
              }

              // Create log file path
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              const filename = `physics_debug_${logData.sessionId}_${timestamp}.json`;
              const filepath = join(debugDir, filename);

              // Write log data
              writeFileSync(filepath, JSON.stringify(logData, null, 2));
              
              console.log(`[DebugLogger] Wrote log to: ${filepath}`);
              
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'success', file: filename }));
            } catch (error) {
              console.error('[DebugLogger] Failed to write log:', error);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'error', message: error.message }));
            }
          });
          return;
        }

        next();
      });
      
      // Add API endpoint for capturing ALL console logs
      server.middlewares.use('/api/console-log', (req, res, next) => {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }
        
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          
          req.on('end', () => {
            try {
              const consoleData = JSON.parse(body);
              const debugDir = join(process.cwd(), 'debug');
              
              // Create debug directory if it doesn't exist
              if (!existsSync(debugDir)) {
                mkdirSync(debugDir, { recursive: true });
              }

              // Create log file path with more readable timestamp
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              const filename = `console_log_${consoleData.sessionId}_${timestamp}.txt`;
              const filepath = join(debugDir, filename);

              // Format console logs as readable text
              const logText = consoleData.logs.map(log => {
                const time = new Date(log.timestamp).toLocaleTimeString();
                return `[${time}] ${log.level.toUpperCase()}: ${log.message}`;
              }).join('\n') + '\n';

              // Write console log data as text
              writeFileSync(filepath, logText);
              
              console.log(`[ConsoleLogger] Wrote ${consoleData.logs.length} console logs to: ${filepath}`);
              
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'success', file: filename, count: consoleData.logs.length }));
            } catch (error) {
              console.error('[ConsoleLogger] Failed to write console log:', error);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'error', message: error.message }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}
