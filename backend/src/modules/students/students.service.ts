import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

function assertNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`${name} is required`);
  }
  return value.trim();
}

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async listStudents(query: { q?: unknown; className?: unknown; take?: unknown }) {
    const q = typeof query.q === 'string' ? query.q.trim() : '';
    const className = typeof query.className === 'string' ? query.className.trim() : '';
    const takeRaw = typeof query.take === 'string' ? Number.parseInt(query.take, 10) : Number(query.take);
    const take = Number.isFinite(takeRaw) ? Math.max(1, Math.min(200, Math.floor(takeRaw))) : 50;

    return this.prisma.student.findMany({
      where: {
        AND: [
          className ? { className: { contains: className } } : {},
          q
            ? {
                OR: [
                  { studentNo: { contains: q } },
                  { name: { contains: q } },
                  { className: { contains: q } },
                ],
              }
            : {},
        ],
      },
      orderBy: [{ className: 'asc' }, { studentNo: 'asc' }],
      take,
      select: { id: true, studentNo: true, name: true, className: true, school: true, major: true },
    });
  }

  async createStudent(input: {
    studentNo?: unknown;
    name?: unknown;
    className?: unknown;
    school?: unknown;
    major?: unknown;
    idCard?: unknown;
  }) {
    const studentNo = assertNonEmptyString(input.studentNo, 'studentNo');
    const name = assertNonEmptyString(input.name, 'name');
    const className = typeof input.className === 'string' ? input.className.trim() : undefined;
    const school = typeof input.school === 'string' ? input.school.trim() : undefined;
    const major = typeof input.major === 'string' ? input.major.trim() : undefined;
    const idCard = typeof input.idCard === 'string' ? input.idCard.trim() : undefined;

    return this.prisma.student.create({
      data: { studentNo, name, className, school, major, idCard },
      select: { id: true, studentNo: true, name: true, className: true, school: true, major: true, idCard: true },
    });
  }

  async getStudent(studentId: string) {
    const s = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, studentNo: true, name: true, className: true, school: true, major: true, idCard: true },
    });
    if (!s) throw new NotFoundException('student not found');
    return s;
  }

  async updateStudent(studentId: string, input: { name?: unknown; className?: unknown; school?: unknown; major?: unknown; idCard?: unknown }) {
    // ensure exists
    await this.getStudent(studentId);
    const data: any = {};
    if (input.name !== undefined) data.name = assertNonEmptyString(input.name, 'name');
    if (input.className !== undefined) data.className = typeof input.className === 'string' ? input.className.trim() : null;
    if (input.school !== undefined) data.school = typeof input.school === 'string' ? input.school.trim() : null;
    if (input.major !== undefined) data.major = typeof input.major === 'string' ? input.major.trim() : null;
    if (input.idCard !== undefined) data.idCard = typeof input.idCard === 'string' ? input.idCard.trim() : null;

    return this.prisma.student.update({
      where: { id: studentId },
      data,
      select: { id: true, studentNo: true, name: true, className: true, school: true, major: true, idCard: true },
    });
  }

  async deleteStudent(studentId: string) {
    // ensure exists
    await this.getStudent(studentId);
    await this.prisma.student.delete({ where: { id: studentId } });
    return { ok: true };
  }

  async setStudentLoginCode(studentId: string, code: unknown) {
    const c = assertNonEmptyString(code, 'code');
    if (c.length < 4 || c.length > 32) {
      throw new BadRequestException('code length must be 4~32');
    }

    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('student not found');

    // store in shahex mode so student login can send codeSha256 only
    const passwordHash = this.authService.hashPasswordFromPlain(c, 'shahex');
    await this.prisma.studentAuth.upsert({
      where: { studentId },
      create: { studentId, passwordHash },
      update: { passwordHash },
    });

    return { ok: true };
  }
}


