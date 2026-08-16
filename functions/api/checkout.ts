import { quickCodeUser, supabaseHeaders, type QuickCodeEnv } from '../_quickcode';

export const onRequest: PagesFunction<QuickCodeEnv> = async ({ request, env }) => {
  const user = await quickCodeUser(request, env);
  if (!user) return Response.json({ error: 'Sign in required before checkout' }, { status: 401 });
  if (!env.STRIPE_SECRET_KEY) return Response.json({ error: 'Stripe is not configured.' }, { status: 500 });

  const stripeHeaders = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' };
  let priceId = env.STRIPE_PRICE_ID;
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

  const configuredOrigin = (env.PUBLIC_SITE_URL || new URL(request.url).origin).trim();
  const origin = /^https?:\/\//i.test(configuredOrigin) ? configuredOrigin.replace(/\/$/, '') : `https://${configuredOrigin.replace(/^\/+/, '').replace(/\/$/, '')}`;
  const body = new URLSearchParams({ mode: 'subscription', customer: customerId, 'line_items[0][quantity]': '1', success_url: `${origin}/dashboard?checkout=success`, cancel_url: `${origin}/pricing`, 'metadata[user_id]': user.id });
  if (priceId) {
    body.set('line_items[0][price]', priceId);
  } else {
    body.set('line_items[0][price_data][currency]', 'usd');
    body.set('line_items[0][price_data][unit_amount]', '599');
    body.set('line_items[0][price_data][recurring][interval]', 'month');
    body.set('line_items[0][price_data][product_data][name]', 'QuickCode Dynamic');
    body.set('line_items[0][price_data][product_data][description]', 'Unlimited editable QR codes, analytics, custom colors, and logo overlays.');
  }
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: stripeHeaders, body });
  if (!response.ok) {
    const stripeError = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    return Response.json({ error: `Stripe Checkout could not be created: ${stripeError?.error?.message || 'check the Price ID, secret key, and Stripe account'}` }, { status: 502 });
  }
  const session = (await response.json()) as { url?: string };
  if (!session.url) return Response.json({ error: 'Stripe returned no Checkout URL.' }, { status: 502 });
  return Response.json({ url: session.url });
};
