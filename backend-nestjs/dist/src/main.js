"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const configService = app.get(config_1.ConfigService);
    const apiKey = configService.get('API_KEY');
    if (apiKey) {
        app.use((req, res, next) => {
            if (req.headers['x-api-key'] !== apiKey) {
                return res.status(401).json({ ok: false, message: 'API_KEY invalida' });
            }
            next();
        });
    }
    const port = configService.get('PORT', 3000);
    await app.listen(port);
}
bootstrap();
//# sourceMappingURL=main.js.map