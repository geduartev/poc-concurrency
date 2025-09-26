"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountNotebookModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const account_notebook_entity_1 = require("./account-notebook.entity");
const user_notebook_subscription_entity_1 = require("./user-notebook-subscription.entity");
const account_notebook_service_1 = require("./account-notebook.service");
const account_notebook_controller_1 = require("./account-notebook.controller");
let AccountNotebookModule = class AccountNotebookModule {
};
exports.AccountNotebookModule = AccountNotebookModule;
exports.AccountNotebookModule = AccountNotebookModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([account_notebook_entity_1.AccountNotebook, user_notebook_subscription_entity_1.UserNotebookSubscription])],
        providers: [account_notebook_service_1.AccountNotebookService],
        controllers: [account_notebook_controller_1.AccountNotebookController],
    })
], AccountNotebookModule);
//# sourceMappingURL=account-notebook.module.js.map