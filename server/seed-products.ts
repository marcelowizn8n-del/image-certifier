import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  const stripe = await getUncachableStripeClient();
  
  console.log('Creating Image Certifier subscription products...');

  // Check if products already exist
  const existingProducts = await stripe.products.search({ query: "name:'Image Certifier'" });
  if (existingProducts.data.length > 0) {
    console.log('Products already exist, skipping...');
    return;
  }

  // Basic Plan - R$ 19,90/mês
  const basicProduct = await stripe.products.create({
    name: 'Image Certifier Básico',
    description: '100 análises por mês, histórico completo',
    metadata: {
      tier: 'basic',
      analysisLimit: '100',
    },
  });

  await stripe.prices.create({
    product: basicProduct.id,
    unit_amount: 1990, // R$ 19,90 in centavos
    currency: 'brl',
    recurring: { interval: 'month' },
    metadata: { tier: 'basic' },
  });

  console.log('Created Basic product:', basicProduct.id);

  // Premium Plan - R$ 49,90/mês
  const premiumProduct = await stripe.products.create({
    name: 'Image Certifier Premium',
    description: 'Análises ilimitadas, batch processing, API access',
    metadata: {
      tier: 'premium',
      analysisLimit: 'unlimited',
    },
  });

  await stripe.prices.create({
    product: premiumProduct.id,
    unit_amount: 4990, // R$ 49,90 in centavos
    currency: 'brl',
    recurring: { interval: 'month' },
    metadata: { tier: 'premium' },
  });

  console.log('Created Premium product:', premiumProduct.id);

  // Enterprise Plan - R$ 199,90/mês
  const enterpriseProduct = await stripe.products.create({
    name: 'Image Certifier Empresarial',
    description: 'Tudo + suporte prioritário, múltiplos usuários',
    metadata: {
      tier: 'enterprise',
      analysisLimit: 'unlimited',
    },
  });

  await stripe.prices.create({
    product: enterpriseProduct.id,
    unit_amount: 19990, // R$ 199,90 in centavos
    currency: 'brl',
    recurring: { interval: 'month' },
    metadata: { tier: 'enterprise' },
  });

  console.log('Created Enterprise product:', enterpriseProduct.id);

  console.log('All products created successfully!');
}

createProducts().catch(console.error);
