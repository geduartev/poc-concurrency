import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountNotebook } from './account-notebook.entity';
import { UserNotebookSubscription } from './user-notebook-subscription.entity';
import { AccountNotebookService } from './account-notebook.service';
import { AccountNotebookController } from './account-notebook.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AccountNotebook, UserNotebookSubscription])],
  providers: [AccountNotebookService],
  controllers: [AccountNotebookController],
})
export class AccountNotebookModule {}
