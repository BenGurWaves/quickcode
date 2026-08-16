import { quickCodeUser, supabaseHeaders, type QuickCodeEnv } from '../_quickcode';

export const onRequest: PagesFunction<QuickCodeEnv> = async ({ request, env }) => {
  const user = await quickCodeUser(request, env);
  if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 });
  const headers = supabaseHeaders(env);
  const accessResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/qc_subscriptions?user_id=eq.${user.id}&select=plan,status`, { headers });
  const access = (await accessResponse.json()) as Array<{ plan: string; status: string }>;
  if (access[0]?.plan !== 'paid' || !['active', 'trialing'].includes(access[0]?.status)) return Response.json({ error: 'Paid plan required' }, { status: 403 });
  if (request.method === 'GET') {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/qc_dynamic_codes?user_id=eq.${user.id}&select=id,redirect_slug,current_destination_url,label,created_at&order=created_at.desc`, {headers});
    const codes = await response.json() as Array<{id:string;redirect_slug:string;current_destination_url:string;label:string;created_at:string}>;
    const result = await Promise.all(codes.map(async code => { const scans = await fetch(`${env.SUPABASE_URL}/rest/v1/qc_scan_log?dynamic_code_id=eq.${code.id}&select=id`, {headers:{...headers,Prefer:'count=exact'}}); const range = scans.headers.get('content-range') || ''; const count = Number(range.split('/')[1] || 0); return {...code, scans: Number.isFinite(count)?count:0, redirectUrl:`${env.PUBLIC_SITE_URL.replace(/\/$/,'')}/r/${code.redirect_slug}`}; }));
    return Response.json({codes:result});
  }
  if (request.method === 'PATCH') {
    const input = await request.json() as {id?:string;destinationUrl?:string;label?:string};
    if (!input.id || !input.destinationUrl || !/^https?:\/\//i.test(input.destinationUrl)) return Response.json({error:'A valid code id and destination URL are required'},{status:400});
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/qc_dynamic_codes?id=eq.${encodeURIComponent(input.id)}&user_id=eq.${user.id}`, {method:'PATCH',headers:{...headers,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({current_destination_url:input.destinationUrl,...(input.label?{label:input.label}:{})})});
    if(!response.ok)return Response.json({error:'Could not update dynamic code'},{status:502}); return Response.json((await response.json())[0]);
  }
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  const input = (await request.json()) as { destinationUrl?: string; label?: string };
  if (!input.destinationUrl || !/^https?:\/\//i.test(input.destinationUrl)) return Response.json({ error: 'A valid destination URL is required' }, { status: 400 });
  const slug = crypto.randomUUID().replaceAll('-', '').slice(0, 10);
  const insertResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/qc_dynamic_codes`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ user_id: user.id, redirect_slug: slug, current_destination_url: input.destinationUrl, label: input.label || 'QuickCode' }) });
  if (!insertResponse.ok) return Response.json({ error: 'Could not create dynamic code' }, { status: 502 });
  const rows = (await insertResponse.json()) as Array<{ id: string; redirect_slug: string }>;
  return Response.json({ id: rows[0].id, redirectUrl: `${env.PUBLIC_SITE_URL.replace(/\/$/, '')}/r/${rows[0].redirect_slug}` });
};
