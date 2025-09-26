export declare class AccountNotebook {
    id: string;
    account_id_creditor: string;
    account_id_debtor: string;
    user_id_creditor: string;
    user_id_debtor: string;
    document_number_creditor: string | null;
    amount: string;
    status: string;
    id_transaction: string | null;
    created_at: Date;
    update_at: Date;
    id_transaction_pay_shopkeeper: string | null;
    status_by_pay_shopkeeper: string | null;
}
