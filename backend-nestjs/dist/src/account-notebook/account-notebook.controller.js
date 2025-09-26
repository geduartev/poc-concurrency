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
exports.AccountNotebookController = void 0;
const common_1 = require("@nestjs/common");
const account_notebook_service_1 = require("./account-notebook.service");
let AccountNotebookController = class AccountNotebookController {
    constructor(accountNotebookService) {
        this.accountNotebookService = accountNotebookService;
    }
    async updateStatus(id, body) {
        return this.accountNotebookService.acceptDebt(id, body);
    }
};
exports.AccountNotebookController = AccountNotebookController;
__decorate([
    (0, common_1.Patch)(':id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AccountNotebookController.prototype, "updateStatus", null);
exports.AccountNotebookController = AccountNotebookController = __decorate([
    (0, common_1.Controller)('account-notebook'),
    __metadata("design:paramtypes", [account_notebook_service_1.AccountNotebookService])
], AccountNotebookController);
//# sourceMappingURL=account-notebook.controller.js.map