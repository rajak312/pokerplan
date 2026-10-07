import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppErrorFilter } from './common/app-error.filter';
import { AppConfig } from './config/app-config.service';
import { ConfiguredIoAdapter } from './socket-io.adapter';

/** Shared between `main.ts` and the e2e tests so both run the exact same app. */
export function setupApp(app: INestApplication): INestApplication {
  const config = app.get(AppConfig);
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app.useGlobalFilters(new AppErrorFilter());
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) =>
      cb(null, config.isOriginAllowed(origin)),
    credentials: true,
  });
  app.useWebSocketAdapter(new ConfiguredIoAdapter(app, config));

  const docs = new DocumentBuilder()
    .setTitle('PokerPlan API')
    .setDescription(
      'REST endpoints for rooms and history. The live session runs over Socket.IO — see the `ClientToServerEvents` / `ServerToClientEvents` contracts in `packages/shared`.',
    )
    .setVersion('1.0.0')
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, docs));
  return app;
}
