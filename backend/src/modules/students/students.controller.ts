import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StudentsService } from './students.service';
import type { SetStudentLoginCodeDto } from './dto/set-login-code.dto';
import type { CreateStudentDto } from './dto/create-student.dto';
import type { UpdateStudentDto } from './dto/update-student.dto';

@Controller('students')
@UseGuards(AuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @Roles('TEACHER')
  list(@Query() query: { q?: string; className?: string; take?: string }) {
    return this.studentsService.listStudents(query);
  }

  @Post()
  @Roles('TEACHER')
  create(@Body() body: CreateStudentDto) {
    return this.studentsService.createStudent(body);
  }

  @Get(':studentId')
  @Roles('TEACHER')
  getOne(@Param('studentId') studentId: string) {
    return this.studentsService.getStudent(studentId);
  }

  @Patch(':studentId')
  @Roles('TEACHER')
  update(@Param('studentId') studentId: string, @Body() body: UpdateStudentDto) {
    return this.studentsService.updateStudent(studentId, body);
  }

  @Delete(':studentId')
  @Roles('TEACHER')
  remove(@Param('studentId') studentId: string) {
    return this.studentsService.deleteStudent(studentId);
  }

  @Post(':studentId/login-code')
  @Roles('TEACHER')
  setLoginCode(@Param('studentId') studentId: string, @Body() body: SetStudentLoginCodeDto) {
    return this.studentsService.setStudentLoginCode(studentId, body?.code);
  }
}



