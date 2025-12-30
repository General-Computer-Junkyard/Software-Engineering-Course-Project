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
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
function asInt(value, name) {
    const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
    if (!Number.isFinite(parsed)) {
        throw new common_1.BadRequestException(`${name} must be a number`);
    }
    return parsed;
}
function assertExamType(value, name) {
    if (value === 'CET4' || value === 'CET6')
        return value;
    throw new common_1.BadRequestException(`${name} must be CET4 or CET6`);
}
let ReportsService = class ReportsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getClassStats(query) {
        const passLine = query.passLine ? asInt(query.passLine, 'passLine') : 425;
        const examType = query.examType ? assertExamType(query.examType, 'examType') : undefined;
        const year = query.year ? asInt(query.year, 'year') : undefined;
        const month = query.month ? asInt(query.month, 'month') : undefined;
        const examBatchId = typeof query.examBatchId === 'string' ? query.examBatchId : undefined;
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
        const rows = await this.prisma.score.findMany({
            where,
            select: {
                totalScore: true,
                student: { select: { className: true } },
            },
        });
        const map = new Map();
        for (const r of rows) {
            const className = r.student.className?.trim() || '未分班';
            const score = r.totalScore ?? 0;
            const item = map.get(className) ??
                { className, total: 0, pass: 0, sum: 0, min: score, max: score };
            item.total += 1;
            item.sum += score;
            item.min = Math.min(item.min, score);
            item.max = Math.max(item.max, score);
            if (score >= passLine)
                item.pass += 1;
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
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReportsService);
//# sourceMappingURL=reports.service.js.map