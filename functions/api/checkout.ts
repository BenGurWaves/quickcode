import { quickCodeUser, supabaseHeaders, type QuickCodeEnv } from '../_quickcode';

export const onRequest: PagesFunction<QuickCodeEnv> = async ({ request, env }) => {
  const user = await quickCodeUser(request, env);
  if (!user) return Response.json({ error: 'Sign in required before checkout' }, { status: 401 });
  if (!env.STRIPE_SECRET_KEY || (!env.STRIPE_PRICE_ID && !env.STRIPE_PRODUCT_ID)) {
    return Response.json({ error: 'Add STRIPE_PRICE_ID or STRIPE_PRODUCT_ID in Cloudflare Pages.' }, { status: 500 });
  }

  const stripeHeaders = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' };
  let priceId = env.STRIPE_PRICE_ID;
  if (!priceId && env.STRIPE_PRODUCT_ID) {
    const productResponse = await fetch(`https://api.stripe.com/v1/products/${encodeURIComponent(env.STRIPE_PRODUCT_ID)}`, { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
    const product = (await productResponse.json()) as { default_price?: string | { id: string } | null };
    priceId = typeof product.default_price === 'string' ? product.default_price : product.default_price?.id;
  }
  if (!priceId) return Response.json({ error: 'The Stripe product has no default price. Add a recurring price in Stripe.' }, { status: 500 });

  const headers = supabaseHeaders(env);
  const existingResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/qc_subscriptions?user_id=eq.${user.id}&select=stripe_customer_id`, { headers });
  const existing = (await existingResponse.json()) as Array<{ stripe_customer_id?: string }>;
  let customerId = existing[0]?.stripe_customer_id;
  if (!customerId) {
    const customerResponse = await fetch('https://api.stripe.com/v1/customers', { method: 'POST', headers: stripeHeaders, body: new URLSearchParams({ email: user.email || '', 'metadata[user_id]': user.id }) });
    const customer = (await customerResponse.json()) as { id: string };
    customerId = customer.id;
    await fetch(`${env.SUPABASE_URL}/rest/v1/qc_subscriptions`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: user.id, stripe_customer_id: customerId, plan: 'free', status: 'checkout_started' }) });
  }

  const body = new URLSearchParams({ mode: 'subscription', customer: customerId, 'line_items[0][price]': priceId, 'line_items[0][quantity]': '1', success_url: `${env.PUBLIC_SITE_URL}/dashboard?checkout=success`, cancel_url: `${env.PUBLIC_SITE_URL}/pricing`, 'metadata[user_id]': user.id });
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: stripeHeaders, body });
  if (!response.ok) return Response.json({ error: 'Stripe Checkout could not be created.' }, { status: 502 });
  const session = (await response.json()) as { url?: string };
  return Response.redirect(session.url || `${env.PUBLIC_SITE_URL}/pricing`, 303);
};
