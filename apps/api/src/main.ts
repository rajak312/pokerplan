import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AppConfig } from './config/app-config.service';
import { setupApp } from './setup-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  setupApp(app);
  // Render & most PaaS run behind a proxy — trust it so rate limiting sees real client IPs.
  app.set('trust proxy', 1);
  const port = app.get(AppConfig).get('PORT');
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
