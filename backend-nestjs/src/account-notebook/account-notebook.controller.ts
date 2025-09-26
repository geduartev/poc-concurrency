import { Body, Controller, Param, Patch } from '@nestjs/common';
import { AccountNotebookService } from './account-notebook.service';

@Controller('account-notebook')
export class AccountNotebookController {
  constructor(private readonly accountNotebookService: AccountNotebookService) {}

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; user_id_creditor: string },
  ) {
    return this.accountNotebookService.acceptDebt(id, body);
  }
}
