import { env } from '../config/env';

export class Logger {
  private static instance: Logger;
  private readonly prefix: string;

  private constructor(prefix: string = '[TranscriptSearch]') {
    this.prefix = prefix;
  }

  static getInstance(prefix?: string): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(prefix);
    }
    return Logger.instance;
  }

  log(...args: any[]) {
    if (env.isDev || env.isProd) {
      console.log(this.prefix, ...args);
    }
  }

  info(...args: any[]) {
    if (env.isDev || env.isProd) {
      console.info(this.prefix, ...args);
    }
  }

  warn(...args: any[]) {
    if (env.isDev || env.isProd) {
      console.warn(this.prefix, ...args);
    }
  }

  error(...args: any[]) {
    if (env.isDev || env.isProd) {
      console.error(this.prefix, ...args);
    }
  }

  debug(...args: any[]) {
    if (env.isDev) {
      console.debug(this.prefix, ...args);
    }
  }
}

export const logger = Logger.getInstance();