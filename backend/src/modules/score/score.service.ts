import { BadRequestException, Injectable } from '@nestjs/common';
import type { ExamBatch, ExamType, Prisma, ScoreEntrySource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { GetAnalysisQueryDto } from './dto/get-analysis.dto';
import type { ImportScoresDto } from './dto/import-scores.dto';

function asInt(value: unknown, name: string): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new BadRequestException(`${name} must be a number`);
  }
  return parsed;
}

function assertNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`${name} is required`);
  }
  return value.trim();
}

function parseDate(value: unknown, name: string): Date {
  const input = assertNonEmptyString(value, name);
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${name} must be an ISO date string`);
  }
  return date;
}

function assertExamType(value: unknown, name: string): ExamType {
  if (value === 'CET4' || value === 'CET6') return value;
  throw new BadRequestException(`${name} must be CET4 or CET6`);
}

@Injectable()
export class ScoreService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveExamBatch(ref: ImportScoresDto['examBatch']): Promise<ExamBatch> {
    if ('id' in ref) {
      const batch = await this.prisma.examBatch.findUnique({ where: { id: ref.id } });
      if (!batch) throw new BadRequestException('examBatch.id not found');
      return batch;
    }

    const examType = assertExamType(ref.examType, 'examBatch.examType');
    const year = asInt(ref.year, 'examBatch.year');
    const month = asInt(ref.month, 'examBatch.month');
    const examDate = parseDate(ref.examDate, 'examBatch.examDate');
    const name = ref.name?.trim() || `${examType}-${year}-${String(month).padStart(2, '0')}`;

    return this.prisma.examBatch.upsert({
      where: {
        examType_year_month: {
          examType,
          year,
          month,
        },
      },
      create: {
        examType,
        year,
        month,
        name,
        examDate,
      },
      update: {
        name,
        examDate,
      },
    });
  }

  async importScores(dto: ImportScoresDto) {
    if (!dto || typeof dto !== 'object') throw new BadRequestException('body is required');
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException('items must be a non-empty array');
    }

    const examBatch = await this.resolveExamBatch(dto.examBatch);

    const studentNos = dto.items.map((it) => assertNonEmptyString(it.studentNo, 'studentNo'));
    const existingScores = await this.prisma.score.findMany({
      where: {
        examBatchId: examBatch.id,
        student: {
          studentNo: { in: studentNos },
        },
      },
      select: {
        student: { select: { studentNo: true } },
      },
    });
    const existingStudentNoSet = new Set(existingScores.map((s) => s.student.studentNo));

    const defaultEntrySource: ScoreEntrySource | undefined = dto.defaultEntrySource;
    const createdById = dto.createdById;

    let created = 0;
    let updated = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        const studentNo = assertNonEmptyString(item.studentNo, 'studentNo');
        const studentName = assertNonEmptyString(item.studentName, 'studentName');

        const student = await tx.student.upsert({
          where: { studentNo },
          create: {
            studentNo,
            name: studentName,
            school: item.school,
            major: item.major,
            className: item.className,
            idCard: item.idCard,
          },
          update: {
            name: studentName,
            school: item.school,
            major: item.major,
            className: item.className,
            idCard: item.idCard,
          },
        });

        const totalScore = asInt(item.totalScore, 'totalScore');
        const listeningScore = item.listeningScore ?? undefined;
        const readingScore = item.readingScore ?? undefined;
        const writingScore = item.writingScore ?? undefined;
        const oralScore = item.oralScore ?? undefined;

        const entrySource = item.entrySource ?? defaultEntrySource;

        const existed = existingStudentNoSet.has(studentNo);
        await tx.score.upsert({
          where: {
            studentId_examBatchId: {
              studentId: student.id,
              examBatchId: examBatch.id,
            },
          },
          create: {
            studentId: student.id,
            examBatchId: examBatch.id,
            totalScore,
            listeningScore,
            readingScore,
            writingScore,
            oralScore,
            entrySource: entrySource ?? 'MANUAL',
            ocrImageUrl: item.ocrImageUrl,
            ocrRawJson: item.ocrRawJson as any,
            createdById,
          },
          update: {
            totalScore,
            listeningScore,
            readingScore,
            writingScore,
            oralScore,
            entrySource: entrySource ?? 'MANUAL',
            ocrImageUrl: item.ocrImageUrl,
            ocrRawJson: item.ocrRawJson as any,
          },
        });

        if (existed) updated += 1;
        else created += 1;
      }
    });

    return {
      examBatchId: examBatch.id,
      total: dto.items.length,
      created,
      updated,
    };
  }

  async getAnalysis(query: GetAnalysisQueryDto) {
    const passLine = query.passLine ? asInt(query.passLine, 'passLine') : 425;
    const year = query.year ? asInt(query.year, 'year') : undefined;
    const month = query.month ? asInt(query.month, 'month') : undefined;
    const examType = query.examType ? assertExamType(query.examType, 'examType') : undefined;
    const examBatchId = query.examBatchId;

    const examBatchWhere: Prisma.ExamBatchWhereInput = {};
    if (examType) examBatchWhere.examType = examType;
    if (year) examBatchWhere.year = year;
    if (month) examBatchWhere.month = month;

    const where: Prisma.ScoreWhereInput = {};
    if (examBatchId) where.examBatchId = examBatchId;
    if (Object.keys(examBatchWhere).length > 0) where.examBatch = examBatchWhere;

    const [totalCount, passCount, overallAgg, byBatch, passByBatch] = await Promise.all([
      this.prisma.score.count({ where }),
      this.prisma.score.count({ where: { ...where, totalScore: { gte: passLine } } }),
      this.prisma.score.aggregate({
        where,
        _avg: { totalScore: true },
        _min: { totalScore: true },
        _max: { totalScore: true },
      }),
      this.prisma.score.groupBy({
        by: ['examBatchId'],
        where,
        _count: { _all: true },
        _avg: { totalScore: true },
      }),
      this.prisma.score.groupBy({
        by: ['examBatchId'],
        where: { ...where, totalScore: { gte: passLine } },
        _count: { _all: true },
      }),
    ]);

    const batchIds = byBatch.map((b) => b.examBatchId);
    const batches = await this.prisma.examBatch.findMany({
      where: { id: { in: batchIds } },
      select: { id: true, name: true, examType: true, year: true, month: true, examDate: true },
    });
    const batchMap = new Map(batches.map((b) => [b.id, b]));

    const passBatchCountMap = new Map(
      passByBatch.map((p) => [p.examBatchId, p._count._all]),
    );

    const byBatchWithRate = byBatch
      .map((b) => {
        const pass = passBatchCountMap.get(b.examBatchId) ?? 0;
        const total = b._count._all;
        const examBatch = batchMap.get(b.examBatchId);
        return {
          examBatch: examBatch ?? { id: b.examBatchId },
          total,
          pass,
          passRate: total === 0 ? 0 : pass / total,
          avgTotalScore: b._avg.totalScore,
          sortKey: examBatch?.examDate?.getTime() ?? 0,
        };
      })
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ sortKey, ...rest }) => rest);

    return {
      filters: { examBatchId, examType, year, month, passLine },
      totals: {
        totalCount,
        passCount,
        passRate: totalCount === 0 ? 0 : passCount / totalCount,
        avgTotalScore: overallAgg._avg.totalScore,
        minTotalScore: overallAgg._min.totalScore,
        maxTotalScore: overallAgg._max.totalScore,
      },
      byBatch: byBatchWithRate,
    };
  }

  async getStudentScores(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, studentNo: true, name: true, className: true },
    });
    if (!student) throw new BadRequestException('student not found');

    const rows = await this.prisma.score.findMany({
      where: { studentId },
      orderBy: { examBatch: { examDate: 'desc' } },
      select: {
        id: true,
        totalScore: true,
        listeningScore: true,
        readingScore: true,
        writingScore: true,
        oralScore: true,
        createdAt: true,
        examBatch: { select: { id: true, name: true, examType: true, year: true, month: true, examDate: true } },
      },
    });

    return { student, items: rows };
  }

  async getEnrollmentEligibility(studentId: string) {
    const { student, items } = await this.getStudentScores(studentId);
    const passLine = 425;

    const cet4 = items.filter((s) => s.examBatch.examType === 'CET4');
    const bestCet4 = cet4.reduce<{ score: number; examDate: Date } | null>((acc, s) => {
      const v = s.totalScore ?? 0;
      if (!acc) return { score: v, examDate: s.examBatch.examDate };
      if (v > acc.score) return { score: v, examDate: s.examBatch.examDate };
      return acc;
    }, null);

    const passedCet4 = (bestCet4?.score ?? 0) >= passLine;
    const canApplyCet6 = passedCet4;

    return {
      student,
      passLine,
      cet4: {
        passed: passedCet4,
        bestScore: bestCet4?.score ?? null,
        bestExamDate: bestCet4?.examDate ?? null,
      },
      cet6: {
        canApply: canApplyCet6,
        reason: canApplyCet6 ? '已通过四级，可报名六级' : '未通过四级（>=425），暂不可报名六级',
      },
    };
  }
}
