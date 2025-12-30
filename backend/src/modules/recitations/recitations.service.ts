import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ImportRecitationsDto } from './dto/import-recitations.dto';

function assertNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`${name} is required`);
  }
  return value.trim();
}

function asInt(value: unknown, name: string, min: number, max: number): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(parsed)) throw new BadRequestException(`${name} must be a number`);
  const n = Math.floor(parsed);
  if (n < min || n > max) throw new BadRequestException(`${name} must be between ${min} and ${max}`);
  return n;
}

function parseDateOnlyToUtcMidnight(value: unknown, name: string): Date {
  const s = assertNonEmptyString(value, name);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new BadRequestException(`${name} must be YYYY-MM-DD`);
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo, d, 0, 0, 0, 0));
  if (Number.isNaN(dt.getTime())) throw new BadRequestException(`${name} must be a valid date`);
  return dt;
}

function isoDateFromUtcMidnight(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class RecitationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertStudentExists(studentId: string) {
    const exists = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, studentNo: true, name: true, className: true },
    });
    if (!exists) throw new NotFoundException('student not found');
    return exists;
  }

  async upsertForStudent(studentId: string, dto: { date?: unknown; words?: unknown; minutes?: unknown; note?: unknown }) {
    await this.assertStudentExists(studentId);
    const date = parseDateOnlyToUtcMidnight(dto.date, 'date');
    const words = asInt(dto.words, 'words', 0, 20000);
    const minutes = dto.minutes === undefined || dto.minutes === null ? undefined : asInt(dto.minutes, 'minutes', 0, 2000);
    const note = typeof dto.note === 'string' ? dto.note.trim().slice(0, 200) : undefined;

    const row = await this.prisma.recitationEntry.upsert({
      where: { studentId_date: { studentId, date } },
      create: { studentId, date, words, minutes, note },
      update: { words, minutes, note },
      select: { id: true, studentId: true, date: true, words: true, minutes: true, note: true },
    });

    return { ...row, date: isoDateFromUtcMidnight(row.date) };
  }

  async getByStudent(studentId: string, query: { days?: unknown }) {
    const student = await this.assertStudentExists(studentId);
    const daysRaw = typeof query.days === 'string' ? Number.parseInt(query.days, 10) : Number(query.days);
    const days = Number.isFinite(daysRaw) ? Math.max(28, Math.min(365, Math.floor(daysRaw))) : 365;

    const end = new Date();
    const endUtc = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 0, 0, 0, 0));
    const startUtc = new Date(endUtc);
    startUtc.setUTCDate(startUtc.getUTCDate() - (days - 1));

    const rows = await this.prisma.recitationEntry.findMany({
      where: { studentId, date: { gte: startUtc, lte: endUtc } },
      orderBy: { date: 'asc' },
      select: { date: true, words: true, minutes: true, note: true },
    });

    return {
      student,
      range: { start: isoDateFromUtcMidnight(startUtc), end: isoDateFromUtcMidnight(endUtc) },
      items: rows.map((r) => ({ ...r, date: isoDateFromUtcMidnight(r.date) })),
    };
  }

  async importRecitations(dto: ImportRecitationsDto) {
    if (!dto || typeof dto !== 'object') throw new BadRequestException('body is required');

    const records: Array<{
      studentNo: string;
      studentName: string;
      className?: string;
      date: Date;
      words: number;
      minutes?: number;
      note?: string;
    }> = [];

    if ('records' in dto) {
      if (!Array.isArray((dto as any).records) || (dto as any).records.length === 0) {
        throw new BadRequestException('records must be a non-empty array');
      }
      for (const [idx, r] of (dto as any).records.entries()) {
        const studentNo = assertNonEmptyString(r?.studentNo, `records[${idx}].studentNo`);
        const studentName = assertNonEmptyString(r?.studentName ?? r?.name ?? studentNo, `records[${idx}].studentName`);
        const className = typeof r?.className === 'string' ? r.className.trim() : undefined;
        const date = parseDateOnlyToUtcMidnight(r?.date, `records[${idx}].date`);
        const words = asInt(r?.words, `records[${idx}].words`, 0, 20000);
        const minutes = r?.minutes === undefined || r?.minutes === null ? undefined : asInt(r?.minutes, `records[${idx}].minutes`, 0, 2000);
        const note = typeof r?.note === 'string' ? r.note.trim().slice(0, 200) : undefined;
        records.push({ studentNo, studentName, className, date, words, minutes, note });
      }
    } else if ('students' in dto) {
      if (!Array.isArray((dto as any).students) || (dto as any).students.length === 0) {
        throw new BadRequestException('students must be a non-empty array');
      }
      for (const [idx, s] of (dto as any).students.entries()) {
        const studentNo = assertNonEmptyString(s?.studentNo, `students[${idx}].studentNo`);
        const studentName = assertNonEmptyString(s?.name, `students[${idx}].name`);
        const className = typeof s?.className === 'string' ? s.className.trim() : undefined;
        const daily = s?.daily;
        if (!daily || typeof daily !== 'object') {
          throw new BadRequestException(`students[${idx}].daily must be an object`);
        }
        for (const [dateStr, wordsRaw] of Object.entries(daily as Record<string, unknown>)) {
          const date = parseDateOnlyToUtcMidnight(dateStr, `students[${idx}].daily date`);
          const words = asInt(wordsRaw, `students[${idx}].daily[${dateStr}]`, 0, 20000);
          records.push({ studentNo, studentName, className, date, words });
        }
      }
    } else {
      throw new BadRequestException('body must contain either records or students');
    }

    let studentsUpserted = 0;
    let recitationsUpserted = 0;

    await this.prisma.$transaction(async (tx) => {
      const studentCache = new Map<string, { id: string }>();
      for (const r of records) {
        const cached = studentCache.get(r.studentNo);
        const student =
          cached ??
          (await tx.student.upsert({
            where: { studentNo: r.studentNo },
            create: { studentNo: r.studentNo, name: r.studentName, className: r.className },
            update: { name: r.studentName, className: r.className },
            select: { id: true },
          }));
        if (!cached) {
          studentCache.set(r.studentNo, student);
          studentsUpserted += 1;
        }

        await tx.recitationEntry.upsert({
          where: { studentId_date: { studentId: student.id, date: r.date } },
          create: { studentId: student.id, date: r.date, words: r.words, minutes: r.minutes, note: r.note },
          update: { words: r.words, minutes: r.minutes, note: r.note },
        });
        recitationsUpserted += 1;
      }
    });

    return {
      totalRecords: records.length,
      studentsUpserted,
      recitationsUpserted,
    };
  }
}


