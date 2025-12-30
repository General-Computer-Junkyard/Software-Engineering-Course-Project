import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(AuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('class-stats')
  @Roles('TEACHER')
  getClassStats(
    @Query()
    query: { examType?: string; year?: string; month?: string; examBatchId?: string; passLine?: string },
  ) {
    return this.reportsService.getClassStats(query);
  }
}




