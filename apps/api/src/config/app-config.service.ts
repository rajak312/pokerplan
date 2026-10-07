import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from './env';

/** Typed accessor around Nest's ConfigService. */
@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  /** Accepts any origin when `*` is configured, otherwise an explicit allow-list. */
  isOriginAllowed(origin: string | undefined): boolean {
    const allowed = this.get('CORS_ORIGINS');
    if (!origin) return true; // same-origin, curl, server-to-server
    return allowed.includes('*') || allowed.includes(origin.replace(/\/$/, ''));
  }
}
