import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import {
  initConnection,
  endConnection,
  getSubscriptions,
  requestSubscription,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  type ProductPurchase,
  type SubscriptionPurchase,
  type Subscription,
  getAvailablePurchases,
} from 'react-native-iap';

const API_BASE_URL = 'https://imgcertifier.app';

// Product IDs — must match App Store Connect and Google Play Console
const SUBSCRIPTION_SKUS = Platform.select({
  ios: [
    'app.imgcertifier.basic.monthly',
    'app.imgcertifier.premium.monthly',
    'app.imgcertifier.enterprise.monthly',
  ],
  android: [
    'app.imgcertifier.basic.monthly',
    'app.imgcertifier.premium.monthly',
    'app.imgcertifier.enterprise.monthly',
  ],
  default: [],
});

interface IAPContextType {
  subscriptions: Subscription[];
  isPremium: boolean;
  isLoading: boolean;
  purchaseInProgress: boolean;
  subscribe: (sku: string) => Promise<void>;
  restorePurchases: () => Promise<void>;
}

const IAPContext = createContext<IAPContextType>({
  subscriptions: [],
  isPremium: false,
  isLoading: true,
  purchaseInProgress: false,
  subscribe: async () => {},
  restorePurchases: async () => {},
});

export const useIAP = () => useContext(IAPContext);

export function IAPProvider({ children }: { children: React.ReactNode }) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const purchaseUpdateSubscription = useRef<any>(null);
  const purchaseErrorSubscription = useRef<any>(null);

  // Verify receipt with our backend
  const verifyWithBackend = useCallback(async (purchase: ProductPurchase | SubscriptionPurchase) => {
    try {
      const isIOS = Platform.OS === 'ios';
      const endpoint = isIOS ? '/api/apple/verify-receipt' : '/api/google/verify-purchase';

      const body = isIOS
        ? { receiptData: purchase.transactionReceipt }
        : {
            packageName: 'app.imgcertifier.mobile',
            productId: purchase.productId,
            purchaseToken: purchase.purchaseToken,
          };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();
      if (result.success) {
        setIsPremium(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Backend verification failed:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        await initConnection();

        // Fetch available subscriptions
        const subs = await getSubscriptions({ skus: SUBSCRIPTION_SKUS });
        if (isMounted) {
          setSubscriptions(subs);
        }

        // Check for existing purchases
        try {
          const purchases = await getAvailablePurchases();
          if (isMounted && purchases.length > 0) {
            // User has active purchases — verify the latest
            const latestPurchase = purchases[purchases.length - 1];
            await verifyWithBackend(latestPurchase);
          }
        } catch (err) {
          console.log('No existing purchases found');
        }
      } catch (error) {
        console.error('IAP init error:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    init();

    // Listen for purchase updates
    purchaseUpdateSubscription.current = purchaseUpdatedListener(async (purchase) => {
      try {
        const verified = await verifyWithBackend(purchase);
        if (verified) {
          await finishTransaction({ purchase, isConsumable: false });
        }
      } catch (error) {
        console.error('Error processing purchase:', error);
      } finally {
        setPurchaseInProgress(false);
      }
    });

    // Listen for purchase errors
    purchaseErrorSubscription.current = purchaseErrorListener((error) => {
      console.error('Purchase error:', error);
      setPurchaseInProgress(false);
      if (error.code !== 'E_USER_CANCELLED') {
        Alert.alert('Purchase Error', error.message || 'An error occurred during purchase.');
      }
    });

    return () => {
      isMounted = false;
      purchaseUpdateSubscription.current?.remove();
      purchaseErrorSubscription.current?.remove();
      endConnection();
    };
  }, [verifyWithBackend]);

  const subscribe = useCallback(async (sku: string) => {
    try {
      setPurchaseInProgress(true);

      if (Platform.OS === 'android') {
        // Android requires offerToken from subscriptionOfferDetails
        const sub = subscriptions.find((s) => s.productId === sku);
        const offerToken = (sub as any)?.subscriptionOfferDetails?.[0]?.offerToken;
        await requestSubscription({
          sku,
          ...(offerToken ? { subscriptionOffers: [{ sku, offerToken }] } : {}),
        });
      } else {
        await requestSubscription({ sku });
      }
    } catch (error: any) {
      setPurchaseInProgress(false);
      if (error.code !== 'E_USER_CANCELLED') {
        Alert.alert('Error', 'Failed to start purchase. Please try again.');
      }
    }
  }, [subscriptions]);

  const restorePurchases = useCallback(async () => {
    try {
      setIsLoading(true);
      const purchases = await getAvailablePurchases();
      if (purchases.length > 0) {
        const latestPurchase = purchases[purchases.length - 1];
        const verified = await verifyWithBackend(latestPurchase);
        if (verified) {
          Alert.alert('Success', 'Your subscription has been restored.');
        } else {
          Alert.alert('Info', 'No active subscription found.');
        }
      } else {
        Alert.alert('Info', 'No previous purchases found.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [verifyWithBackend]);

  return (
    <IAPContext.Provider
      value={{
        subscriptions,
        isPremium,
        isLoading,
        purchaseInProgress,
        subscribe,
        restorePurchases,
      }}
    >
      {children}
    </IAPContext.Provider>
  );
}
