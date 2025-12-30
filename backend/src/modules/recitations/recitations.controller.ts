import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthedRequest } from '../auth/auth.guard';
import { RecitationsService } from './recitations.service';
import type { UpsertRecitationDto } from './dto/upsert-recitation.dto';
import { Req } from '@nestjs/common';
import type { ImportRecitationsDto } from './dto/import-recitations.dto';

@Controller('recitations')
@UseGuards(AuthGuard, RolesGuard)
export class RecitationsController {
  constructor(private readonly recitationsService: RecitationsService) {}

  @Post('me')
  @Roles('STUDENT')
  upsertMe(@Req() req: AuthedRequest, @Body() body: UpsertRecitationDto) {
    const studentId = req.auth!.sub;
    return this.recitationsService.upsertForStudent(studentId, body);
  }

  @Get('me')
  @Roles('STUDENT')
  getMe(@Req() req: AuthedRequest, @Query() query: { days?: string }) {
    const studentId = req.auth!.sub;
    return this.recitationsService.getByStudent(studentId, query);
  }

  @Post('student/:studentId')
  @Roles('TEACHER')
  upsertForStudent(@Param('studentId') studentId: string, @Body() body: UpsertRecitationDto) {
    return this.recitationsService.upsertForStudent(studentId, body);
  }

  @Get('student/:studentId')
  @Roles('TEACHER')
  getForStudent(@Param('studentId') studentId: string, @Query() query: { days?: string }) {
    return this.recitationsService.getByStudent(studentId, query);
  }

  @Post('import')
  @Roles('TEACHER')
  importRecitations(@Body() body: ImportRecitationsDto) {
    return this.recitationsService.importRecitations(body);
  }
}


