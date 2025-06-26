// Centralized logging utility for the application
// Provides structured logging with environment-based control

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface LogConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableStructured: boolean;
}

class Logger {
  private config: LogConfig;

  constructor() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    // Fallback for Vite/React apps if process.env.NODE_ENV is undefined
    const isProduction = process.env.NODE_ENV === 'production';
    
    this.config = {
      level: isDevelopment ? LogLevel.DEBUG : LogLevel.INFO,
      enableConsole: true,
      enableStructured: isDevelopment
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.config.level;
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const baseMessage = `[${timestamp}] [${level}] ${message}`;
    
    if (data !== undefined) {
      return `${baseMessage} ${JSON.stringify(data, null, this.config.enableStructured ? 2 : 0)}`;
    }
    
    return baseMessage;
  }

  error(message: string, error?: any, context?: any): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const logMessage = this.formatMessage('ERROR', message, context);
    
    if (this.config.enableConsole) {
      if (error) {
        console.error(logMessage, error);
      } else {
        console.error(logMessage);
      }
    }
  }

  warn(message: string, data?: any): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    const logMessage = this.formatMessage('WARN', message, data);
    
    if (this.config.enableConsole) {
      console.warn(logMessage);
    }
  }

  info(message: string, data?: any): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    const logMessage = this.formatMessage('INFO', message, data);
    
    if (this.config.enableConsole) {
      console.log(logMessage);
    }
  }

  debug(message: string, data?: any): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const logMessage = this.formatMessage('DEBUG', message, data);
    
    if (this.config.enableConsole) {
      console.log(logMessage);
    }
  }

  // Special method for development-only verbose logging
  dev(message: string, data?: any): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] ${message}`, data);
    }
  }

  // Method for logging large data objects (truncated in production)
  data(message: string, data: any): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    if (this.config.enableStructured) {
      console.log(`[DATA] ${message}:`, data);
    } else {
      // In production, just log the message without the data
      this.info(message);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export const logError = (message: string, error?: any, context?: any) => logger.error(message, error, context);
export const logWarn = (message: string, data?: any) => logger.warn(message, data);
export const logInfo = (message: string, data?: any) => logger.info(message, data);
export const logDebug = (message: string, data?: any) => logger.debug(message, data);
export const logDev = (message: string, data?: any) => logger.dev(message, data);
export const logData = (message: string, data: any) => logger.data(message, data); 