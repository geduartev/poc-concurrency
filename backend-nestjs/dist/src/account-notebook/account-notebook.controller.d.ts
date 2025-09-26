import { AccountNotebookService } from './account-notebook.service';
export declare class AccountNotebookController {
    private readonly accountNotebookService;
    constructor(accountNotebookService: AccountNotebookService);
    updateStatus(id: string, body: {
        status: string;
        user_id_creditor: string;
    }): Promise<{
        ok: true;
        incentive: "LowerLimitToPay" | "LimitCanPay" | "HigherLimitToPay";
        txId?: string;
    }>;
}
