import { isDev, isProd } from '../config/env';

export class Logger {
  private static instance: Logger;
  private readonly prefix: string;

  private constructor(prefix = '[TranscriptSearch]') {
    this.prefix = prefix;
  }

  static getInstance(prefix?: string): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(prefix);
    }
    return Logger.instance;
  }

  log(...args: any[]) {
    if (isDev || isProd) console.log(this.prefix, ...args);
  }

  info(...args: any[]) {
    if (isDev || isProd) console.info(this.prefix, ...args);
  }

  warn(...args: any[]) {
    if (isDev || isProd) console.warn(this.prefix, ...args);
  }

  error(...args: any[]) {
    if (isDev || isProd) console.error(this.prefix, ...args);
  }

  debug(...args: any[]) {
    if (isDev) console.debug(this.prefix, ...args);
  }
}

export const logger = Logger.getInstance();
