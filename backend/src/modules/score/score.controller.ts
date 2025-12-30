import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthedRequest } from '../auth/auth.guard';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { GetAnalysisQueryDto } from './dto/get-analysis.dto';
import type { ImportScoresDto } from './dto/import-scores.dto';
import { ScoreService } from './score.service';

@Controller('scores')
@UseGuards(AuthGuard, RolesGuard)
export class ScoreController {
  constructor(private readonly scoreService: ScoreService) {}

  @Post('import')
  @Roles('TEACHER')
  importScores(@Body() body: ImportScoresDto) {
    return this.scoreService.importScores(body);
  }

  @Get('analysis')
  @Roles('TEACHER')
  getAnalysis(@Query() query: GetAnalysisQueryDto) {
    return this.scoreService.getAnalysis(query);
  }

  @Get('me')
  @Roles('STUDENT')
  getMyScores(@Req() req: AuthedRequest) {
    return this.scoreService.getStudentScores(req.auth!.sub);
  }

  @Get('me/eligibility')
  @Roles('STUDENT')
  getMyEligibility(@Req() req: AuthedRequest) {
    return this.scoreService.getEnrollmentEligibility(req.auth!.sub);
  }
}

