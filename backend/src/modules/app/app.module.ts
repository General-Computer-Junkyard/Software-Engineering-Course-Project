import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ScoreModule } from '../score/score.module';
import { AuthModule } from '../auth/auth.module';
import { StudentsModule } from '../students/students.module';
import { RecitationsModule } from '../recitations/recitations.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [PrismaModule, ScoreModule, AuthModule, StudentsModule, RecitationsModule, ReportsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
