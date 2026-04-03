import { MercadoPagoConfig, PreApprovalPlan, PreApproval, Payment } from 'mercadopago';

let client: MercadoPagoConfig | null = null;

function getCredentials() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const publicKey = process.env.MERCADOPAGO_PUBLIC_KEY;

  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN environment variable is required');
  }

  return { accessToken, publicKey: publicKey || '' };
}

export function getMercadoPagoClient(): MercadoPagoConfig {
  if (!client) {
    const { accessToken } = getCredentials();
    client = new MercadoPagoConfig({ accessToken });
  }
  return client;
}

export function getMercadoPagoPublicKey(): string {
  const { publicKey } = getCredentials();
  return publicKey;
}

export function getPreApprovalPlanClient() {
  return new PreApprovalPlan(getMercadoPagoClient());
}

export function getPreApprovalClient() {
  return new PreApproval(getMercadoPagoClient());
}

export function getPaymentClient() {
  return new Payment(getMercadoPagoClient());
}
