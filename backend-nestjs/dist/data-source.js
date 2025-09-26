"use strict";
var _a, _b, _c, _d, _e;
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataSourceOptions = void 0;
const dotenv_1 = require("dotenv");
const typeorm_1 = require("typeorm");
const account_notebook_entity_1 = require("./src/account-notebook/account-notebook.entity");
const user_notebook_subscription_entity_1 = require("./src/account-notebook/user-notebook-subscription.entity");
(0, dotenv_1.config)();
const databaseUrl = process.env.DATABASE_URL;
const baseConnection = databaseUrl
    ? {
        type: 'postgres',
        url: databaseUrl,
    }
    : {
        type: 'postgres',
        host: (_a = process.env.PGHOST) !== null && _a !== void 0 ? _a : 'localhost',
        port: Number((_b = process.env.PGPORT) !== null && _b !== void 0 ? _b : 5432),
        database: (_c = process.env.PGDATABASE) !== null && _c !== void 0 ? _c : 'poc_concurrency',
        username: (_d = process.env.PGUSER) !== null && _d !== void 0 ? _d : 'postgres',
        password: (_e = process.env.PGPASSWORD) !== null && _e !== void 0 ? _e : 'postgres',
    };
exports.dataSourceOptions = {
    ...baseConnection,
    entities: [account_notebook_entity_1.AccountNotebook, user_notebook_subscription_entity_1.UserNotebookSubscription],
    migrations: ['dist/migrations/*.js'],
    synchronize: false,
    logging: process.env.TYPEORM_LOGGING === 'true',
};
const appDataSource = new typeorm_1.DataSource(exports.dataSourceOptions);
exports.default = appDataSource;
//# sourceMappingURL=data-source.js.map