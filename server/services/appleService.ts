import { storage } from '../storage';

const APPLE_VERIFY_RECEIPT_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_VERIFY_RECEIPT_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';

export class AppleService {
    async verifyReceipt(receiptData: string, userId?: string) {
        let response = await this.callAppleVerify(receiptData, APPLE_VERIFY_RECEIPT_URL);

        // If it's a sandbox receipt being sent to production, try sandbox
        if (response.status === 21007) {
            response = await this.callAppleVerify(receiptData, APPLE_SANDBOX_VERIFY_RECEIPT_URL);
        }

        if (response.status !== 0) {
            throw new Error(`Apple receipt verification failed with status: ${response.status}`);
        }

        // Process the receipt (e.g., check for active subscription)
        const latestReceiptInfo = response.latest_receipt_info || response.receipt.in_app;
        if (!latestReceiptInfo || latestReceiptInfo.length === 0) {
            throw new Error('No purchase info found in receipt');
        }

        // For simplicity, we'll mark the user as premium if we have a valid receipt
        if (userId) {
            await storage.updateUser(userId, { isPremium: true });
        }

        return response;
    }

    private async callAppleVerify(receiptData: string, url: string) {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({
                'receipt-data': receiptData,
                // 'password': process.env.APPLE_SHARED_SECRET // Required for auto-renewable subscriptions
            }),
            headers: { 'Content-Type': 'application/json' },
        });

        return response.json();
    }
}

export const appleService = new AppleService();
