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

        // Process the receipt — check for active subscription
        const latestReceiptInfo = response.latest_receipt_info || response.receipt?.in_app;
        if (!latestReceiptInfo || latestReceiptInfo.length === 0) {
            throw new Error('No purchase info found in receipt');
        }

        // Find the most recent transaction and check expiry
        const sortedReceipts = [...latestReceiptInfo].sort(
            (a: any, b: any) =>
                parseInt(b.expires_date_ms || b.purchase_date_ms || '0') -
                parseInt(a.expires_date_ms || a.purchase_date_ms || '0')
        );
        const latestTransaction = sortedReceipts[0];

        // For subscriptions, check if it's still active
        const expiresDateMs = parseInt(latestTransaction.expires_date_ms || '0');
        const isActive = expiresDateMs === 0 || expiresDateMs > Date.now();

        if (!isActive) {
            // Subscription expired — revoke premium
            if (userId) {
                await storage.updateUser(userId, { isPremium: false });
            }
            throw new Error('Subscription has expired');
        }

        // Active subscription — mark user as premium
        if (userId) {
            await storage.updateUser(userId, { isPremium: true });
        }

        return {
            ...response,
            subscriptionActive: isActive,
            expiresDate: expiresDateMs ? new Date(expiresDateMs).toISOString() : null,
            productId: latestTransaction.product_id,
        };
    }

    private async callAppleVerify(receiptData: string, url: string) {
        const body: Record<string, string> = {
            'receipt-data': receiptData,
        };

        // Required for auto-renewable subscriptions
        if (process.env.APPLE_SHARED_SECRET) {
            body['password'] = process.env.APPLE_SHARED_SECRET;
        }

        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
        });

        return response.json();
    }
}

export const appleService = new AppleService();
