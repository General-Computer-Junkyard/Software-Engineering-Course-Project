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
exports.RecitationsController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../auth/auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const recitations_service_1 = require("./recitations.service");
const common_2 = require("@nestjs/common");
let RecitationsController = class RecitationsController {
    recitationsService;
    constructor(recitationsService) {
        this.recitationsService = recitationsService;
    }
    upsertMe(req, body) {
        const studentId = req.auth.sub;
        return this.recitationsService.upsertForStudent(studentId, body);
    }
    getMe(req, query) {
        const studentId = req.auth.sub;
        return this.recitationsService.getByStudent(studentId, query);
    }
    upsertForStudent(studentId, body) {
        return this.recitationsService.upsertForStudent(studentId, body);
    }
    getForStudent(studentId, query) {
        return this.recitationsService.getByStudent(studentId, query);
    }
    importRecitations(body) {
        return this.recitationsService.importRecitations(body);
    }
};
exports.RecitationsController = RecitationsController;
__decorate([
    (0, common_1.Post)('me'),
    (0, roles_decorator_1.Roles)('STUDENT'),
    __param(0, (0, common_2.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], RecitationsController.prototype, "upsertMe", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, roles_decorator_1.Roles)('STUDENT'),
    __param(0, (0, common_2.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], RecitationsController.prototype, "getMe", null);
__decorate([
    (0, common_1.Post)('student/:studentId'),
    (0, roles_decorator_1.Roles)('TEACHER'),
    __param(0, (0, common_1.Param)('studentId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], RecitationsController.prototype, "upsertForStudent", null);
__decorate([
    (0, common_1.Get)('student/:studentId'),
    (0, roles_decorator_1.Roles)('TEACHER'),
    __param(0, (0, common_1.Param)('studentId')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], RecitationsController.prototype, "getForStudent", null);
__decorate([
    (0, common_1.Post)('import'),
    (0, roles_decorator_1.Roles)('TEACHER'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RecitationsController.prototype, "importRecitations", null);
exports.RecitationsController = RecitationsController = __decorate([
    (0, common_1.Controller)('recitations'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [recitations_service_1.RecitationsService])
], RecitationsController);
//# sourceMappingURL=recitations.controller.js.map