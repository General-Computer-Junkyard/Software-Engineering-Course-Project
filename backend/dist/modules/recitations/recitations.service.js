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
exports.RecitationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
function assertNonEmptyString(value, name) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new common_1.BadRequestException(`${name} is required`);
    }
    return value.trim();
}
function asInt(value, name, min, max) {
    const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
    if (!Number.isFinite(parsed))
        throw new common_1.BadRequestException(`${name} must be a number`);
    const n = Math.floor(parsed);
    if (n < min || n > max)
        throw new common_1.BadRequestException(`${name} must be between ${min} and ${max}`);
    return n;
}
function parseDateOnlyToUtcMidnight(value, name) {
    const s = assertNonEmptyString(value, name);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m)
        throw new common_1.BadRequestException(`${name} must be YYYY-MM-DD`);
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo, d, 0, 0, 0, 0));
    if (Number.isNaN(dt.getTime()))
        throw new common_1.BadRequestException(`${name} must be a valid date`);
    return dt;
}
function isoDateFromUtcMidnight(date) {
    return date.toISOString().slice(0, 10);
}
let RecitationsService = class RecitationsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async assertStudentExists(studentId) {
        const exists = await this.prisma.student.findUnique({
            where: { id: studentId },
            select: { id: true, studentNo: true, name: true, className: true },
        });
        if (!exists)
            throw new common_1.NotFoundException('student not found');
        return exists;
    }
    async upsertForStudent(studentId, dto) {
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
    async getByStudent(studentId, query) {
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
    async importRecitations(dto) {
        if (!dto || typeof dto !== 'object')
            throw new common_1.BadRequestException('body is required');
        const records = [];
        if ('records' in dto) {
            if (!Array.isArray(dto.records) || dto.records.length === 0) {
                throw new common_1.BadRequestException('records must be a non-empty array');
            }
            for (const [idx, r] of dto.records.entries()) {
                const studentNo = assertNonEmptyString(r?.studentNo, `records[${idx}].studentNo`);
                const studentName = assertNonEmptyString(r?.studentName ?? r?.name ?? studentNo, `records[${idx}].studentName`);
                const className = typeof r?.className === 'string' ? r.className.trim() : undefined;
                const date = parseDateOnlyToUtcMidnight(r?.date, `records[${idx}].date`);
                const words = asInt(r?.words, `records[${idx}].words`, 0, 20000);
                const minutes = r?.minutes === undefined || r?.minutes === null ? undefined : asInt(r?.minutes, `records[${idx}].minutes`, 0, 2000);
                const note = typeof r?.note === 'string' ? r.note.trim().slice(0, 200) : undefined;
                records.push({ studentNo, studentName, className, date, words, minutes, note });
            }
        }
        else if ('students' in dto) {
            if (!Array.isArray(dto.students) || dto.students.length === 0) {
                throw new common_1.BadRequestException('students must be a non-empty array');
            }
            for (const [idx, s] of dto.students.entries()) {
                const studentNo = assertNonEmptyString(s?.studentNo, `students[${idx}].studentNo`);
                const studentName = assertNonEmptyString(s?.name, `students[${idx}].name`);
                const className = typeof s?.className === 'string' ? s.className.trim() : undefined;
                const daily = s?.daily;
                if (!daily || typeof daily !== 'object') {
                    throw new common_1.BadRequestException(`students[${idx}].daily must be an object`);
                }
                for (const [dateStr, wordsRaw] of Object.entries(daily)) {
                    const date = parseDateOnlyToUtcMidnight(dateStr, `students[${idx}].daily date`);
                    const words = asInt(wordsRaw, `students[${idx}].daily[${dateStr}]`, 0, 20000);
                    records.push({ studentNo, studentName, className, date, words });
                }
            }
        }
        else {
            throw new common_1.BadRequestException('body must contain either records or students');
        }
        let studentsUpserted = 0;
        let recitationsUpserted = 0;
        await this.prisma.$transaction(async (tx) => {
            const studentCache = new Map();
            for (const r of records) {
                const cached = studentCache.get(r.studentNo);
                const student = cached ??
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
};
exports.RecitationsService = RecitationsService;
exports.RecitationsService = RecitationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RecitationsService);
//# sourceMappingURL=recitations.service.js.map