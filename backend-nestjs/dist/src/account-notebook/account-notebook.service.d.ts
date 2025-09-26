import { DataSource } from 'typeorm';
type IncentiveFlag = 'LowerLimitToPay' | 'LimitCanPay' | 'HigherLimitToPay';
export declare class AccountNotebookService {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    acceptDebt(id: string, body: {
        status: string;
        user_id_creditor: string;
    }): Promise<{
        ok: true;
        incentive: IncentiveFlag;
        txId?: string;
    }>;
}
export {};
