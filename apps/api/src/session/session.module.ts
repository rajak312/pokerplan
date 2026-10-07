import { Module } from '@nestjs/common';
import { EstimationModule } from '../estimation/estimation.module';
import { PresenceService } from './presence.service';
import { SessionGateway } from './session.gateway';
import { SessionService } from './session.service';

@Module({
  imports: [EstimationModule],
  providers: [SessionService, PresenceService, SessionGateway],
  exports: [SessionService],
})
export class SessionModule {}
