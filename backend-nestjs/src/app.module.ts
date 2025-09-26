import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountNotebookModule } from './account-notebook/account-notebook.module';
import { dataSourceOptions } from '../data-source';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({ ...dataSourceOptions, autoLoadEntities: true }),
    }),
    AccountNotebookModule,
  ],
})
export class AppModule {}
