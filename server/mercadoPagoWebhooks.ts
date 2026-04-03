import { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { users, mpSubscriptions } from '../shared/schema';
import { getPreApprovalClient } from './mercadoPagoClient';

export async function handleMercadoPagoWebhook(req: Request, res: Response) {
  try {
    const { type, data, action } = req.body;

    console.log(`[MP Webhook] type=${type} action=${action} id=${data?.id}`);

    // Respond 200 immediately to avoid retries
    res.status(200).send('OK');

    if (type === 'subscription_preapproval' && data?.id) {
      await handleSubscriptionUpdate(data.id);
    } else if (type === 'payment' && data?.id) {
      console.log(`[MP Webhook] Payment notification for id=${data.id}`);
      // Payment notifications - we mainly care about subscription status changes
      // but log these for audit
    }
  } catch (error) {
    console.error('[MP Webhook] Error processing webhook:', error);
    // Already sent 200, just log the error
  }
}

async function handleSubscriptionUpdate(preapprovalId: string) {
  try {
    const preApprovalClient = getPreApprovalClient();
    const subscription = await preApprovalClient.get({ id: preapprovalId });

    if (!subscription) {
      console.error(`[MP Webhook] Subscription ${preapprovalId} not found in MP`);
      return;
    }

    const externalReference = subscription.external_reference;
    const status = subscription.status as 'authorized' | 'pending' | 'paused' | 'cancelled';
    const payerEmail = subscription.payer_email || '';

    console.log(`[MP Webhook] Subscription ${preapprovalId} status=${status} user=${externalReference}`);

    // Upsert mp_subscriptions record
    const existing = await db
      .select()
      .from(mpSubscriptions)
      .where(eq(mpSubscriptions.mpSubscriptionId, preapprovalId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(mpSubscriptions)
        .set({
          status,
          payerEmail,
          updatedAt: new Date(),
        })
        .where(eq(mpSubscriptions.mpSubscriptionId, preapprovalId));
    } else if (externalReference) {
      await db.insert(mpSubscriptions).values({
        userId: externalReference,
        mpSubscriptionId: preapprovalId,
        mpPlanId: subscription.preapproval_plan_id || null,
        status,
        payerEmail,
      });
    }

    // Update user premium status
    if (externalReference) {
      const isPremium = status === 'authorized';
      await db
        .update(users)
        .set({
          isPremium,
          mpSubscriptionId: preapprovalId,
        })
        .where(eq(users.id, externalReference));

      console.log(`[MP Webhook] User ${externalReference} isPremium=${isPremium}`);
    }
  } catch (error) {
    console.error(`[MP Webhook] Error handling subscription ${preapprovalId}:`, error);
  }
}
