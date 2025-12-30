import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RecitationsController } from './recitations.controller';
import { RecitationsService } from './recitations.service';

@Module({
  imports: [AuthModule],
  controllers: [RecitationsController],
  providers: [RecitationsService],
})
export class RecitationsModule {}



