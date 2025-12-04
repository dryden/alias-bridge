/**
 * Logger Service
 * Provides environment-aware logging with different levels
 * - Development: All logs (debug, info, warn, error)
 * - Production: Only info, warn, error (no debug logs)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LoggerOptions {
  isDevelopment?: boolean
}

class Logger {
  private isDevelopment: boolean

  constructor(options: LoggerOptions = {}) {
    // Check if we're in development mode via environment variable
    // For browser extensions, we default to checking if it's a dev build via __DEV__ or env
    this.isDevelopment = options.isDevelopment ??
      (typeof (globalThis as any).__DEV__ !== 'undefined' && (globalThis as any).__DEV__) ??
      true // Default to development for safety
  }

  private formatMessage(module: string, level: LogLevel): string {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    })
    return `[${timestamp}] [${module}] [${level.toUpperCase()}]`
  }

  debug(module: string, ...args: any[]): void {
    if (!this.isDevelopment) return
    console.log(this.formatMessage(module, 'debug'), ...args)
  }

  info(module: string, ...args: any[]): void {
    console.log(this.formatMessage(module, 'info'), ...args)
  }

  warn(module: string, ...args: any[]): void {
    console.warn(this.formatMessage(module, 'warn'), ...args)
  }

  error(module: string, ...args: any[]): void {
    console.error(this.formatMessage(module, 'error'), ...args)
  }

  /**
   * Set development mode at runtime
   */
  setDevelopmentMode(isDev: boolean): void {
    this.isDevelopment = isDev
  }

  /**
   * Check if currently in development mode
   */
  isDevelopmentMode(): boolean {
    return this.isDevelopment
  }
}

// Export singleton instance
export const logger = new Logger()

export default logger
