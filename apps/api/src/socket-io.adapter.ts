import { type INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';
import { AppConfig } from './config/app-config.service';

/** Socket.IO adapter that shares the REST CORS allow-list. */
export class ConfiguredIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly config: AppConfig,
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) =>
          cb(null, this.config.isOriginAllowed(origin)),
        credentials: true,
      },
      pingInterval: 20_000,
      pingTimeout: 20_000,
    }) as Server;
  }
}
