import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { AppConfigModule } from '../src/config/config.module';
import { EstimationModule } from '../src/estimation/estimation.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { RoomsService } from '../src/rooms/rooms.service';
import { SessionService } from '../src/session/session.service';
import { setupApp } from '../src/setup-app';

/** Service-level module wired to the real (test) database — no HTTP, no sockets. */
export async function createServiceModule(): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: [AppConfigModule, PrismaModule, EstimationModule],
    providers: [RoomsService, SessionService],
  }).compile();
}

/** Full application listening on a random port. */
export async function createE2eApp(): Promise<{ app: INestApplication; url: string }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = setupApp(moduleRef.createNestApplication({ logger: false }));
  await app.listen(0, '127.0.0.1');
  return { app, url: await app.getUrl() };
}

export const newToken = (): string => `test-${randomUUID()}`;
