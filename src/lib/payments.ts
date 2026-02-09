export interface PaymentConfig {
    merchantId: string;
    productName: string;
    productUrl: string;
    amount: number;
}

export const generateESewaSignature = (amount: number, transactionUuid: string, merchantCode: string) => {
    // In a real app, this would be generated server-side securely
    // Signature = base64(hmac_sha256(secret_key, `total_amount=${amount},transaction_uuid=${transactionUuid},product_code=${merchantCode}`))
    return "placeholder_signature";
};

export const initiateKhaltiPayment = async (config: PaymentConfig) => {
    // Placeholder for Khalti payment initiation
    console.log("Initiating Khalti payment for:", config);
    return {
        pidx: "placeholder_pidx",
        payment_url: "https://test-pay.khalti.com/",
    };
};

export const nepaliCurrencyFormatter = new Intl.NumberFormat('ne-NP', {
    style: 'currency',
    currency: 'NPR',
});
