import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const apiKey = configService.get<string>('API_KEY');
  if (apiKey) {
    // Middleware simple para validar API_KEY sin sobre-ingenieria.
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.headers['x-api-key'] !== apiKey) {
        return res.status(401).json({ ok: false, message: 'API_KEY invalida' });
      }
      next();
    });
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
}

bootstrap();
