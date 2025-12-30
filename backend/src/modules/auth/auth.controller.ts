import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('teacher/login')
  loginTeacher(@Body() body: { email?: unknown; password?: unknown; passwordSha256?: unknown }) {
    return this.authService.loginTeacher(body);
  }

  @Post('student/login')
  loginStudent(@Body() body: { studentNo?: unknown; code?: unknown; codeSha256?: unknown }) {
    return this.authService.loginStudent(body);
  }

  @Post('dev/ensure-teacher')
  ensureDevTeacher() {
    return this.authService.ensureDevTeacher();
  }

  @Post('dev/seed-demo')
  seedDemo() {
    return this.authService.seedDevDemoAccounts();
  }

  @Post('dev/seed-demo-data')
  seedDemoData() {
    return this.authService.seedDevDemoData();
  }
}


