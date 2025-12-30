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
exports.StudentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const auth_service_1 = require("../auth/auth.service");
function assertNonEmptyString(value, name) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new common_1.BadRequestException(`${name} is required`);
    }
    return value.trim();
}
let StudentsService = class StudentsService {
    prisma;
    authService;
    constructor(prisma, authService) {
        this.prisma = prisma;
        this.authService = authService;
    }
    async listStudents(query) {
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
    async createStudent(input) {
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
    async getStudent(studentId) {
        const s = await this.prisma.student.findUnique({
            where: { id: studentId },
            select: { id: true, studentNo: true, name: true, className: true, school: true, major: true, idCard: true },
        });
        if (!s)
            throw new common_1.NotFoundException('student not found');
        return s;
    }
    async updateStudent(studentId, input) {
        // ensure exists
        await this.getStudent(studentId);
        const data = {};
        if (input.name !== undefined)
            data.name = assertNonEmptyString(input.name, 'name');
        if (input.className !== undefined)
            data.className = typeof input.className === 'string' ? input.className.trim() : null;
        if (input.school !== undefined)
            data.school = typeof input.school === 'string' ? input.school.trim() : null;
        if (input.major !== undefined)
            data.major = typeof input.major === 'string' ? input.major.trim() : null;
        if (input.idCard !== undefined)
            data.idCard = typeof input.idCard === 'string' ? input.idCard.trim() : null;
        return this.prisma.student.update({
            where: { id: studentId },
            data,
            select: { id: true, studentNo: true, name: true, className: true, school: true, major: true, idCard: true },
        });
    }
    async deleteStudent(studentId) {
        // ensure exists
        await this.getStudent(studentId);
        await this.prisma.student.delete({ where: { id: studentId } });
        return { ok: true };
    }
    async setStudentLoginCode(studentId, code) {
        const c = assertNonEmptyString(code, 'code');
        if (c.length < 4 || c.length > 32) {
            throw new common_1.BadRequestException('code length must be 4~32');
        }
        const student = await this.prisma.student.findUnique({ where: { id: studentId } });
        if (!student)
            throw new common_1.NotFoundException('student not found');
        // store in shahex mode so student login can send codeSha256 only
        const passwordHash = this.authService.hashPasswordFromPlain(c, 'shahex');
        await this.prisma.studentAuth.upsert({
            where: { studentId },
            create: { studentId, passwordHash },
            update: { passwordHash },
        });
        return { ok: true };
    }
};
exports.StudentsService = StudentsService;
exports.StudentsService = StudentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        auth_service_1.AuthService])
], StudentsService);
//# sourceMappingURL=students.service.js.map