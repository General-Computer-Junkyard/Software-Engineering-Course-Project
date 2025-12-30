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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoreController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const roles_guard_1 = require("../auth/roles.guard");
const score_service_1 = require("./score.service");
let ScoreController = class ScoreController {
    scoreService;
    constructor(scoreService) {
        this.scoreService = scoreService;
    }
    importScores(body) {
        return this.scoreService.importScores(body);
    }
    getAnalysis(query) {
        return this.scoreService.getAnalysis(query);
    }
    getMyScores(req) {
        return this.scoreService.getStudentScores(req.auth.sub);
    }
    getMyEligibility(req) {
        return this.scoreService.getEnrollmentEligibility(req.auth.sub);
    }
};
exports.ScoreController = ScoreController;
__decorate([
    (0, common_1.Post)('import'),
    (0, roles_decorator_1.Roles)('TEACHER'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ScoreController.prototype, "importScores", null);
__decorate([
    (0, common_1.Get)('analysis'),
    (0, roles_decorator_1.Roles)('TEACHER'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ScoreController.prototype, "getAnalysis", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, roles_decorator_1.Roles)('STUDENT'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ScoreController.prototype, "getMyScores", null);
__decorate([
    (0, common_1.Get)('me/eligibility'),
    (0, roles_decorator_1.Roles)('STUDENT'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ScoreController.prototype, "getMyEligibility", null);
exports.ScoreController = ScoreController = __decorate([
    (0, common_1.Controller)('scores'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [score_service_1.ScoreService])
], ScoreController);
//# sourceMappingURL=score.controller.js.map