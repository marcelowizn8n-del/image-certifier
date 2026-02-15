import { storage } from '../storage';

const GOOGLE_PLAY_VERIFY_URL = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

export class GooglePlayService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  /**
   * Get an OAuth2 access token using the service account credentials.
   * Requires GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY env vars,
   * or GOOGLE_APPLICATION_CREDENTIALS pointing to a JSON key file.
   */
  private async getAccessToken(): Promise<string> {
    // If we have a cached token that hasn't expired, reuse it
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n');

    if (!clientEmail || !privateKey) {
      throw new Error(
        'Google Play verification requires GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY environment variables'
      );
    }

    // Build JWT for Google OAuth2
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        iss: clientEmail,
        scope: 'https://www.googleapis.com/auth/androidpublisher',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      })
    ).toString('base64url');

    const crypto = await import('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(privateKey, 'base64url');

    const jwt = `${header}.${payload}.${signature}`;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      throw new Error(`Failed to get Google access token: ${err}`);
    }

    const tokenData = await tokenResponse.json() as { access_token: string; expires_in: number };
    this.accessToken = tokenData.access_token;
    this.tokenExpiry = Date.now() + (tokenData.expires_in - 60) * 1000; // refresh 60s early

    return this.accessToken;
  }

  /**
   * Verify a Google Play subscription purchase.
   */
  async verifySubscription(
    packageName: string,
    productId: string,
    purchaseToken: string,
    userId?: string
  ) {
    const accessToken = await this.getAccessToken();

    const url = `${GOOGLE_PLAY_VERIFY_URL}/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Play verification failed: ${response.status} ${errorText}`);
    }

    const data = await response.json() as {
      kind: string;
      startTimeMillis: string;
      expiryTimeMillis: string;
      autoRenewing: boolean;
      paymentState: number;
      cancelReason?: number;
      orderId: string;
    };

    // Check if subscription is currently active
    const expiryTime = parseInt(data.expiryTimeMillis, 10);
    const isActive = expiryTime > Date.now();

    if (!isActive) {
      throw new Error('Subscription has expired');
    }

    // Mark user as premium
    if (userId) {
      await storage.updateUser(userId, { isPremium: true });
    }

    return {
      isActive,
      expiryTime: new Date(expiryTime).toISOString(),
      autoRenewing: data.autoRenewing,
      orderId: data.orderId,
      paymentState: data.paymentState,
    };
  }

  /**
   * Verify a Google Play one-time product purchase.
   */
  async verifyProduct(
    packageName: string,
    productId: string,
    purchaseToken: string,
    userId?: string
  ) {
    const accessToken = await this.getAccessToken();

    const url = `${GOOGLE_PLAY_VERIFY_URL}/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Play product verification failed: ${response.status} ${errorText}`);
    }

    const data = await response.json() as {
      kind: string;
      purchaseTimeMillis: string;
      purchaseState: number;
      consumptionState: number;
      orderId: string;
    };

    // purchaseState: 0 = Purchased, 1 = Canceled, 2 = Pending
    if (data.purchaseState !== 0) {
      throw new Error(`Purchase is not in valid state: ${data.purchaseState}`);
    }

    if (userId) {
      await storage.updateUser(userId, { isPremium: true });
    }

    return {
      isValid: true,
      orderId: data.orderId,
      purchaseTime: new Date(parseInt(data.purchaseTimeMillis, 10)).toISOString(),
    };
  }
}

export const googlePlayService = new GooglePlayService();
