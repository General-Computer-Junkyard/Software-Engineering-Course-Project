"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoreService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
function asInt(value, name) {
    const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
    if (!Number.isFinite(parsed)) {
        throw new common_1.BadRequestException(`${name} must be a number`);
    }
    return parsed;
}
function assertNonEmptyString(value, name) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new common_1.BadRequestException(`${name} is required`);
    }
    return value.trim();
}
function parseDate(value, name) {
    const input = assertNonEmptyString(value, name);
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) {
        throw new common_1.BadRequestException(`${name} must be an ISO date string`);
    }
    return date;
}
function assertExamType(value, name) {
    if (value === 'CET4' || value === 'CET6')
        return value;
    throw new common_1.BadRequestException(`${name} must be CET4 or CET6`);
}
let ScoreService = class ScoreService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async resolveExamBatch(ref) {
        if ('id' in ref) {
            const batch = await this.prisma.examBatch.findUnique({ where: { id: ref.id } });
            if (!batch)
                throw new common_1.BadRequestException('examBatch.id not found');
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
    async importScores(dto) {
        if (!dto || typeof dto !== 'object')
            throw new common_1.BadRequestException('body is required');
        if (!Array.isArray(dto.items) || dto.items.length === 0) {
            throw new common_1.BadRequestException('items must be a non-empty array');
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
        const defaultEntrySource = dto.defaultEntrySource;
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
                        ocrRawJson: item.ocrRawJson,
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
                        ocrRawJson: item.ocrRawJson,
                    },
                });
                if (existed)
                    updated += 1;
                else
                    created += 1;
            }
        });
        return {
            examBatchId: examBatch.id,
            total: dto.items.length,
            created,
            updated,
        };
    }
    async getAnalysis(query) {
        const passLine = query.passLine ? asInt(query.passLine, 'passLine') : 425;
        const year = query.year ? asInt(query.year, 'year') : undefined;
        const month = query.month ? asInt(query.month, 'month') : undefined;
        const examType = query.examType ? assertExamType(query.examType, 'examType') : undefined;
        const examBatchId = query.examBatchId;
        const examBatchWhere = {};
        if (examType)
            examBatchWhere.examType = examType;
        if (year)
            examBatchWhere.year = year;
        if (month)
            examBatchWhere.month = month;
        const where = {};
        if (examBatchId)
            where.examBatchId = examBatchId;
        if (Object.keys(examBatchWhere).length > 0)
            where.examBatch = examBatchWhere;
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
        const passBatchCountMap = new Map(passByBatch.map((p) => [p.examBatchId, p._count._all]));
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
    async getStudentScores(studentId) {
        const student = await this.prisma.student.findUnique({
            where: { id: studentId },
            select: { id: true, studentNo: true, name: true, className: true },
        });
        if (!student)
            throw new common_1.BadRequestException('student not found');
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
    async getEnrollmentEligibility(studentId) {
        const { student, items } = await this.getStudentScores(studentId);
        const passLine = 425;
        const cet4 = items.filter((s) => s.examBatch.examType === 'CET4');
        const bestCet4 = cet4.reduce((acc, s) => {
            const v = s.totalScore ?? 0;
            if (!acc)
                return { score: v, examDate: s.examBatch.examDate };
            if (v > acc.score)
                return { score: v, examDate: s.examBatch.examDate };
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
};
exports.ScoreService = ScoreService;
exports.ScoreService = ScoreService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ScoreService);
//# sourceMappingURL=score.service.js.map