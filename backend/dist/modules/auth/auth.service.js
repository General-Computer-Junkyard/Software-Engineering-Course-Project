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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const crypto_1 = __importDefault(require("crypto"));
function assertNonEmptyString(value, name) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new common_1.BadRequestException(`${name} is required`);
    }
    return value.trim();
}
function base64UrlEncode(input) {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
    return buf
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}
function base64UrlDecode(input) {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (padded.length % 4)) % 4;
    const s = padded + '='.repeat(padLen);
    return Buffer.from(s, 'base64');
}
function sha256Hex(input) {
    return crypto_1.default.createHash('sha256').update(input, 'utf8').digest('hex');
}
let AuthService = class AuthService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    get jwtSecret() {
        return process.env.JWT_SECRET?.trim() || 'dev_change_me';
    }
    /**
     * 存储格式：
     * - 旧格式（plain）：pbkdf2_sha256$120000$$<hex>
     * - 新格式（shahex）：pbkdf2_sha256$120000$shahex$<hex>
     *
     * 说明：shahex 模式下，数据库里存的是 PBKDF2(sha256Hex(明文)).
     * 前端登录时可只发送 sha256Hex(明文)，避免请求体出现明文（但仍建议 HTTPS）。
     */
    hashPasswordFromPlain(password, mode = 'plain') {
        const pw = assertNonEmptyString(password, 'password');
        const input = mode === 'shahex' ? sha256Hex(pw) : pw;
        return this.hashPasswordFromShaHex(input, mode === 'shahex' ? 'shahex' : 'plain');
    }
    hashPasswordFromShaHex(shaHex, mode = 'shahex') {
        const s = assertNonEmptyString(shaHex, 'passwordSha256');
        if (!/^[a-f0-9]{64}$/i.test(s)) {
            throw new common_1.BadRequestException('passwordSha256 must be a 64-length hex string');
        }
        const salt = this.jwtSecret;
        const derived = crypto_1.default.pbkdf2Sync(s.toLowerCase(), salt, 120_000, 32, 'sha256');
        const tag = mode === 'shahex' ? 'shahex' : '';
        return `pbkdf2_sha256$120000$${tag}$${derived.toString('hex')}`;
    }
    verifyPasswordAny(input, storedHash) {
        if (typeof storedHash !== 'string' || storedHash.length === 0)
            return false;
        const parts = storedHash.split('$');
        const scheme = parts[0];
        const iterStr = parts[1];
        const mode = parts[2] ?? '';
        const hex = parts[3] ?? '';
        if (scheme !== 'pbkdf2_sha256')
            return false;
        const iter = Number.parseInt(iterStr, 10);
        if (!Number.isFinite(iter) || iter <= 0)
            return false;
        if (!/^[a-f0-9]+$/i.test(hex) || hex.length !== 64)
            return false;
        const salt = this.jwtSecret;
        let candidateInput = null;
        // shahex: accept passwordSha256, or derive from plaintext password.
        if (mode === 'shahex') {
            if (typeof input.passwordSha256 === 'string' && input.passwordSha256.trim().length > 0) {
                candidateInput = input.passwordSha256.trim().toLowerCase();
            }
            else if (typeof input.password === 'string' && input.password.trim().length > 0) {
                candidateInput = sha256Hex(input.password.trim()).toLowerCase();
            }
        }
        else {
            // plain legacy: accept plaintext password only.
            if (typeof input.password === 'string' && input.password.trim().length > 0) {
                candidateInput = input.password.trim();
            }
        }
        if (!candidateInput)
            return false;
        if (mode === 'shahex' && !/^[a-f0-9]{64}$/i.test(candidateInput))
            return false;
        const derived = crypto_1.default.pbkdf2Sync(candidateInput, salt, iter, 32, 'sha256');
        const expected = Buffer.from(hex.toLowerCase(), 'hex');
        return crypto_1.default.timingSafeEqual(derived, expected);
    }
    signToken(payload) {
        const header = { alg: 'HS256', typ: 'JWT' };
        const exp = payload.exp ?? Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
        const full = { ...payload, exp };
        const h = base64UrlEncode(JSON.stringify(header));
        const p = base64UrlEncode(JSON.stringify(full));
        const msg = `${h}.${p}`;
        const sig = crypto_1.default.createHmac('sha256', this.jwtSecret).update(msg).digest();
        return `${msg}.${base64UrlEncode(sig)}`;
    }
    verifyToken(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3)
                throw new common_1.UnauthorizedException('Invalid token');
            const [h, p, s] = parts;
            const msg = `${h}.${p}`;
            const expected = crypto_1.default.createHmac('sha256', this.jwtSecret).update(msg).digest();
            const got = base64UrlDecode(s);
            if (got.length !== expected.length || !crypto_1.default.timingSafeEqual(got, expected)) {
                throw new common_1.UnauthorizedException('Invalid token signature');
            }
            const payload = JSON.parse(base64UrlDecode(p).toString('utf8'));
            if (!payload?.sub || !payload?.role || !payload?.exp)
                throw new common_1.UnauthorizedException('Invalid token');
            if (Math.floor(Date.now() / 1000) > payload.exp)
                throw new common_1.UnauthorizedException('Token expired');
            return { sub: payload.sub, role: payload.role, name: payload.name, studentNo: payload.studentNo };
        }
        catch (e) {
            if (e instanceof common_1.UnauthorizedException)
                throw e;
            throw new common_1.UnauthorizedException(e?.message ? String(e.message) : 'Invalid token');
        }
    }
    async loginTeacher(input) {
        const email = assertNonEmptyString(input.email, 'email').toLowerCase();
        const password = typeof input.password === 'string' ? input.password : undefined;
        const passwordSha256 = typeof input.passwordSha256 === 'string' ? input.passwordSha256 : undefined;
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user)
            throw new common_1.UnauthorizedException('Invalid email or password');
        if (!this.verifyPasswordAny({ password, passwordSha256 }, user.passwordHash)) {
            throw new common_1.UnauthorizedException('Invalid email or password');
        }
        const token = this.signToken({ sub: user.id, role: 'TEACHER', name: user.displayName });
        return {
            token,
            user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
        };
    }
    async loginStudent(input) {
        const studentNo = assertNonEmptyString(input.studentNo, 'studentNo');
        const code = typeof input.code === 'string' ? input.code : undefined;
        const codeSha256 = typeof input.codeSha256 === 'string' ? input.codeSha256 : undefined;
        const student = await this.prisma.student.findUnique({
            where: { studentNo },
            include: { auth: true },
        });
        if (!student)
            throw new common_1.UnauthorizedException('Invalid studentNo or code');
        // Rule: if StudentAuth exists => verify stored hash; otherwise default code = last 6 digits of studentNo
        if (student.auth) {
            if (!this.verifyPasswordAny({ password: code, passwordSha256: codeSha256 }, student.auth.passwordHash)) {
                throw new common_1.UnauthorizedException('Invalid studentNo or code');
            }
        }
        else {
            const expected = studentNo.slice(-6);
            if (typeof codeSha256 === 'string' && codeSha256.trim().length > 0) {
                if (sha256Hex(expected).toLowerCase() !== codeSha256.trim().toLowerCase()) {
                    throw new common_1.UnauthorizedException('Invalid studentNo or code');
                }
            }
            else {
                const c = assertNonEmptyString(code, 'code');
                if (c !== expected)
                    throw new common_1.UnauthorizedException('Invalid studentNo or code');
            }
        }
        const token = this.signToken({
            sub: student.id,
            role: 'STUDENT',
            name: student.name,
            studentNo: student.studentNo,
        });
        return {
            token,
            student: {
                id: student.id,
                studentNo: student.studentNo,
                name: student.name,
                className: student.className,
            },
        };
    }
    async ensureDevTeacher() {
        const env = (process.env.NODE_ENV || 'development').toLowerCase();
        if (env === 'production')
            throw new common_1.BadRequestException('Not allowed in production');
        const email = (process.env.DEV_TEACHER_EMAIL || 'teacher@local').toLowerCase();
        const displayName = process.env.DEV_TEACHER_NAME || '默认教师';
        const password = process.env.DEV_TEACHER_PASSWORD || 'teacher123';
        // use shahex mode so frontend can send passwordSha256 only
        const passwordHash = this.hashPasswordFromPlain(password, 'shahex');
        const user = await this.prisma.user.upsert({
            where: { email },
            create: { email, displayName, passwordHash, role: 'ADMIN' },
            update: { displayName, passwordHash, role: 'ADMIN' },
        });
        return {
            email: user.email,
            displayName: user.displayName,
            password,
            note: '仅开发环境：若数据库里没有教师账号，可用此账号登录教师端。',
        };
    }
    async seedDevDemoAccounts() {
        const env = (process.env.NODE_ENV || 'development').toLowerCase();
        if (env === 'production')
            throw new common_1.BadRequestException('Not allowed in production');
        const teachers = [
            { email: 'teacher1@local', displayName: '教师 1', password: 'teacher123' },
            { email: 'teacher2@local', displayName: '教师 2', password: 'teacher123' },
            { email: 'teacher3@local', displayName: '教师 3', password: 'teacher123' },
        ];
        const students = [
            { studentNo: '202512340001', name: '张三', className: '计科 1 班', code: '111111' },
            { studentNo: '202512340002', name: '李四', className: '计科 1 班', code: '222222' },
            { studentNo: '202512340003', name: '王五', className: '计科 2 班', code: '333333' },
            { studentNo: '202512340004', name: '赵六', className: '软工 1 班', code: '444444' },
            { studentNo: '202512340005', name: '钱七', className: '软工 2 班', code: '555555' },
        ];
        const createdTeachers = [];
        const createdStudents = [];
        await this.prisma.$transaction(async (tx) => {
            for (const t of teachers) {
                const user = await tx.user.upsert({
                    where: { email: t.email },
                    create: {
                        email: t.email,
                        displayName: t.displayName,
                        passwordHash: this.hashPasswordFromPlain(t.password, 'shahex'),
                        role: 'ADMIN',
                    },
                    update: {
                        displayName: t.displayName,
                        passwordHash: this.hashPasswordFromPlain(t.password, 'shahex'),
                        role: 'ADMIN',
                    },
                    select: { id: true, email: true, displayName: true },
                });
                createdTeachers.push({ ...user, password: t.password });
            }
            for (const s of students) {
                const student = await tx.student.upsert({
                    where: { studentNo: s.studentNo },
                    create: { studentNo: s.studentNo, name: s.name, className: s.className },
                    update: { name: s.name, className: s.className },
                    select: { id: true, studentNo: true, name: true, className: true },
                });
                await tx.studentAuth.upsert({
                    where: { studentId: student.id },
                    create: { studentId: student.id, passwordHash: this.hashPasswordFromPlain(s.code, 'shahex') },
                    update: { passwordHash: this.hashPasswordFromPlain(s.code, 'shahex') },
                });
                createdStudents.push({ ...student, code: s.code });
            }
        });
        return {
            teachers: createdTeachers,
            students: createdStudents,
            note: '仅开发环境：用于快速体验学生端/教师端登录。',
        };
    }
    async seedDevDemoData() {
        const env = (process.env.NODE_ENV || 'development').toLowerCase();
        if (env === 'production')
            throw new common_1.BadRequestException('Not allowed in production');
        const classes = ['计科 1 班', '计科 2 班', '软工 1 班', '软工 2 班', '信安 1 班'];
        const studentCount = 30;
        const now = new Date();
        const year = now.getUTCFullYear();
        const cet4Month = 6;
        const cet6Month = 12;
        const cet4ExamDate = new Date(Date.UTC(year, cet4Month - 1, 15, 0, 0, 0, 0));
        const cet6ExamDate = new Date(Date.UTC(year, cet6Month - 1, 15, 0, 0, 0, 0));
        // Create or reuse batches
        const [cet4Batch, cet6Batch] = await this.prisma.$transaction([
            this.prisma.examBatch.upsert({
                where: { examType_year_month: { examType: 'CET4', year, month: cet4Month } },
                create: { examType: 'CET4', year, month: cet4Month, name: `CET4-${year}-${String(cet4Month).padStart(2, '0')}`, examDate: cet4ExamDate },
                update: { examDate: cet4ExamDate },
            }),
            this.prisma.examBatch.upsert({
                where: { examType_year_month: { examType: 'CET6', year, month: cet6Month } },
                create: { examType: 'CET6', year, month: cet6Month, name: `CET6-${year}-${String(cet6Month).padStart(2, '0')}`, examDate: cet6ExamDate },
                update: { examDate: cet6ExamDate },
            }),
        ]);
        const createdStudents = [];
        let createdScores = 0;
        let createdRecitations = 0;
        // Deterministic pseudo-random
        const rand = (seed) => {
            let x = seed | 0;
            x ^= x << 13;
            x ^= x >>> 17;
            x ^= x << 5;
            return (x >>> 0) / 0xffffffff;
        };
        const startNo = 202512349001;
        const startDate = new Date();
        startDate.setUTCHours(0, 0, 0, 0);
        startDate.setUTCDate(startDate.getUTCDate() - 59);
        await this.prisma.$transaction(async (tx) => {
            for (let i = 0; i < studentCount; i += 1) {
                const studentNo = String(startNo + i);
                const name = `学生${String(i + 1).padStart(2, '0')}`;
                const className = classes[i % classes.length];
                const student = await tx.student.upsert({
                    where: { studentNo },
                    create: { studentNo, name, className },
                    update: { name, className },
                    select: { id: true, studentNo: true, name: true, className: true },
                });
                createdStudents.push(student);
                // CET4 score around pass line with per-class variance
                const base4 = 360 + Math.round((i % 10) * 12) + Math.round((i % classes.length) * 8);
                const jitter4 = Math.round((rand(i + 11) - 0.5) * 40);
                const total4 = Math.max(200, Math.min(710, base4 + jitter4));
                // CET6 only for some students (simulate eligibility)
                const eligible = total4 >= 425;
                const base6 = eligible ? 360 + Math.round((i % 10) * 10) : 0;
                const jitter6 = eligible ? Math.round((rand(i + 99) - 0.5) * 50) : 0;
                const total6 = eligible ? Math.max(220, Math.min(710, base6 + jitter6)) : null;
                await tx.score.upsert({
                    where: { studentId_examBatchId: { studentId: student.id, examBatchId: cet4Batch.id } },
                    create: {
                        studentId: student.id,
                        examBatchId: cet4Batch.id,
                        totalScore: total4,
                        listeningScore: Math.round(total4 * 0.33),
                        readingScore: Math.round(total4 * 0.34),
                        writingScore: Math.round(total4 * 0.33),
                        entrySource: 'IMPORT',
                    },
                    update: {
                        totalScore: total4,
                        listeningScore: Math.round(total4 * 0.33),
                        readingScore: Math.round(total4 * 0.34),
                        writingScore: Math.round(total4 * 0.33),
                        entrySource: 'IMPORT',
                    },
                });
                createdScores += 1;
                if (total6 !== null) {
                    await tx.score.upsert({
                        where: { studentId_examBatchId: { studentId: student.id, examBatchId: cet6Batch.id } },
                        create: {
                            studentId: student.id,
                            examBatchId: cet6Batch.id,
                            totalScore: total6,
                            listeningScore: Math.round(total6 * 0.33),
                            readingScore: Math.round(total6 * 0.34),
                            writingScore: Math.round(total6 * 0.33),
                            entrySource: 'IMPORT',
                        },
                        update: {
                            totalScore: total6,
                            listeningScore: Math.round(total6 * 0.33),
                            readingScore: Math.round(total6 * 0.34),
                            writingScore: Math.round(total6 * 0.33),
                            entrySource: 'IMPORT',
                        },
                    });
                    createdScores += 1;
                }
                // Recitations for last 60 days (sparse)
                for (let d = 0; d < 60; d += 1) {
                    const p = rand(i * 1000 + d * 17 + 7);
                    if (p < 0.45)
                        continue; // ~55% days active
                    const date = new Date(startDate);
                    date.setUTCDate(startDate.getUTCDate() + d);
                    const words = Math.round(20 + p * 180); // 20~200
                    await tx.recitationEntry.upsert({
                        where: { studentId_date: { studentId: student.id, date } },
                        create: { studentId: student.id, date, words, minutes: Math.round(words / 6) },
                        update: { words, minutes: Math.round(words / 6) },
                    });
                    createdRecitations += 1;
                }
            }
        });
        return {
            examBatches: [
                { id: cet4Batch.id, examType: cet4Batch.examType, year: cet4Batch.year, month: cet4Batch.month, name: cet4Batch.name },
                { id: cet6Batch.id, examType: cet6Batch.examType, year: cet6Batch.year, month: cet6Batch.month, name: cet6Batch.name },
            ],
            studentsAddedOrUpdated: createdStudents.length,
            scoresUpserted: createdScores,
            recitationsUpserted: createdRecitations,
            note: '仅开发环境：用于快速查看班级通过率/均分图表与学生端成绩/热图效果。',
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuthService);
//# sourceMappingURL=auth.service.js.map