import { quickCodeUser, supabaseHeaders, type QuickCodeEnv } from '../_quickcode';

export const onRequest: PagesFunction<QuickCodeEnv> = async ({ request, env }) => {
  const user = await quickCodeUser(request, env);
  if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 });
  const headers = supabaseHeaders(env);
  const subResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/qc_subscriptions?user_id=eq.${user.id}&select=*`, { headers });
  const rows = (await subResponse.json()) as Array<{ stripe_customer_id?: string; plan: string; status: string }>;
  let plan = rows[0]?.plan === 'paid' && ['active', 'trialing'].includes(rows[0]?.status) ? 'paid' : 'free';

  if (rows[0]?.stripe_customer_id && env.STRIPE_SECRET_KEY) {
    const stripeResponse = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(rows[0].stripe_customer_id)}&status=all&limit=10`, {
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    });
    if (stripeResponse.ok) {
      const stripe = (await stripeResponse.json()) as { data?: Array<{ id: string; status: string; current_period_end: number }> };
      const active = stripe.data?.find((item) => ['active', 'trialing'].includes(item.status));
      plan = active ? 'paid' : 'free';
      await fetch(`${env.SUPABASE_URL}/rest/v1/qc_subscriptions?user_id=eq.${user.id}`, {
        method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ plan, status: active?.status ?? 'free', stripe_subscription_id: active?.id ?? null, updated_at: new Date().toISOString() }),
      });
    }
  }
  return Response.json({ user: { id: user.id, email: user.email }, plan, canCreateDynamic: plan === 'paid', canUseAnalytics: plan === 'paid', canCustomize: plan === 'paid' });
};
