import { BadRequestException, Injectable } from '@nestjs/common';
import type { ExamType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

function asInt(value: unknown, name: string): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new BadRequestException(`${name} must be a number`);
  }
  return parsed;
}

function assertExamType(value: unknown, name: string): ExamType {
  if (value === 'CET4' || value === 'CET6') return value;
  throw new BadRequestException(`${name} must be CET4 or CET6`);
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getClassStats(query: {
    examType?: unknown;
    year?: unknown;
    month?: unknown;
    examBatchId?: unknown;
    passLine?: unknown;
  }) {
    const passLine = query.passLine ? asInt(query.passLine, 'passLine') : 425;
    const examType = query.examType ? assertExamType(query.examType, 'examType') : undefined;
    const year = query.year ? asInt(query.year, 'year') : undefined;
    const month = query.month ? asInt(query.month, 'month') : undefined;
    const examBatchId = typeof query.examBatchId === 'string' ? query.examBatchId : undefined;

    const examBatchWhere: Prisma.ExamBatchWhereInput = {};
    if (examType) examBatchWhere.examType = examType;
    if (year) examBatchWhere.year = year;
    if (month) examBatchWhere.month = month;

    const where: Prisma.ScoreWhereInput = {};
    if (examBatchId) where.examBatchId = examBatchId;
    if (Object.keys(examBatchWhere).length > 0) where.examBatch = examBatchWhere;

    const rows = await this.prisma.score.findMany({
      where,
      select: {
        totalScore: true,
        student: { select: { className: true } },
      },
    });

    const map = new Map<
      string,
      { className: string; total: number; pass: number; sum: number; min: number; max: number }
    >();

    for (const r of rows) {
      const className = r.student.className?.trim() || '未分班';
      const score = r.totalScore ?? 0;
      const item =
        map.get(className) ??
        { className, total: 0, pass: 0, sum: 0, min: score, max: score };
      item.total += 1;
      item.sum += score;
      item.min = Math.min(item.min, score);
      item.max = Math.max(item.max, score);
      if (score >= passLine) item.pass += 1;
      map.set(className, item);
    }

    const classes = [...map.values()]
      .map((c) => ({
        className: c.className,
        total: c.total,
        pass: c.pass,
        passRate: c.total === 0 ? 0 : c.pass / c.total,
        avgTotalScore: c.total === 0 ? null : c.sum / c.total,
        minTotalScore: c.total === 0 ? null : c.min,
        maxTotalScore: c.total === 0 ? null : c.max,
      }))
      .sort((a, b) => b.total - a.total || a.className.localeCompare(b.className));

    return {
      filters: { examType, year, month, examBatchId, passLine },
      totals: {
        classCount: classes.length,
        totalCount: rows.length,
      },
      classes,
    };
  }
}




