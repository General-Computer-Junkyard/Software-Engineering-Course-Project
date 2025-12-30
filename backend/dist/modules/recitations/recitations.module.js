"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecitationsModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const recitations_controller_1 = require("./recitations.controller");
const recitations_service_1 = require("./recitations.service");
let RecitationsModule = class RecitationsModule {
};
exports.RecitationsModule = RecitationsModule;
exports.RecitationsModule = RecitationsModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule],
        controllers: [recitations_controller_1.RecitationsController],
        providers: [recitations_service_1.RecitationsService],
    })
], RecitationsModule);
//# sourceMappingURL=recitations.module.js.map