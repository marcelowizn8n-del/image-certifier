import { getPreApprovalPlanClient, getPreApprovalClient } from './mercadoPagoClient';

export class MercadoPagoService {
  async createPlan(data: {
    name: string;
    description?: string;
    amount: number; // in centavos (e.g., 1990 = R$19.90)
    backUrl: string;
  }) {
    const planClient = getPreApprovalPlanClient();
    const result = await planClient.create({
      body: {
        reason: data.name,
        back_url: data.backUrl,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: data.amount / 100, // MP expects reais, not centavos
          currency_id: 'BRL',
        },
      },
    });
    return result;
  }

  async createSubscriptionCheckout(data: {
    planId: string;
    payerEmail: string;
    userId: string;
    backUrl: string;
  }) {
    const preApprovalClient = getPreApprovalClient();
    const result = await preApprovalClient.create({
      body: {
        preapproval_plan_id: data.planId,
        payer_email: data.payerEmail,
        external_reference: data.userId,
        back_url: data.backUrl,
      },
    });
    return result;
  }

  async getSubscription(subscriptionId: string) {
    const preApprovalClient = getPreApprovalClient();
    return await preApprovalClient.get({ id: subscriptionId });
  }

  async cancelSubscription(subscriptionId: string) {
    const preApprovalClient = getPreApprovalClient();
    return await preApprovalClient.update({
      id: subscriptionId,
      body: { status: 'cancelled' },
    });
  }

  async reactivateSubscription(subscriptionId: string) {
    const preApprovalClient = getPreApprovalClient();
    return await preApprovalClient.update({
      id: subscriptionId,
      body: { status: 'authorized' },
    });
  }

  async pauseSubscription(subscriptionId: string) {
    const preApprovalClient = getPreApprovalClient();
    return await preApprovalClient.update({
      id: subscriptionId,
      body: { status: 'paused' },
    });
  }
}

export const mercadoPagoService = new MercadoPagoService();
