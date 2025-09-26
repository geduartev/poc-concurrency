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
exports.UserNotebookSubscription = void 0;
const typeorm_1 = require("typeorm");
let UserNotebookSubscription = class UserNotebookSubscription {
};
exports.UserNotebookSubscription = UserNotebookSubscription;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'uuid' }),
    __metadata("design:type", String)
], UserNotebookSubscription.prototype, "user_id_creditor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 40, default: 'default' }),
    __metadata("design:type", String)
], UserNotebookSubscription.prototype, "type_subscription", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', default: () => 'now()' }),
    __metadata("design:type", Date)
], UserNotebookSubscription.prototype, "date_subscription", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], UserNotebookSubscription.prototype, "notebook_start_limit", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 10 }),
    __metadata("design:type", Number)
], UserNotebookSubscription.prototype, "notebook_end_limit", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], UserNotebookSubscription.prototype, "notebook_count_accepted", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], UserNotebookSubscription.prototype, "is_pay_completed", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', default: () => 'now()' }),
    __metadata("design:type", Date)
], UserNotebookSubscription.prototype, "update_at", void 0);
exports.UserNotebookSubscription = UserNotebookSubscription = __decorate([
    (0, typeorm_1.Entity)({ name: 'user_notebook_subscription' })
], UserNotebookSubscription);
//# sourceMappingURL=user-notebook-subscription.entity.js.map