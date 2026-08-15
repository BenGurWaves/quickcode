interface Env { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string }
export const onRequest: PagesFunction<Env> = async ({params,env}) => {
  const slug = String(params.slug || '').replace(/[^a-zA-Z0-9_-]/g,'');
  const headers = {'apikey':env.SUPABASE_SERVICE_ROLE_KEY,'Authorization':`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`};
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/dynamic_codes?redirect_slug=eq.${encodeURIComponent(slug)}&select=id,current_destination_url&limit=1`,{headers});
  const rows = await response.json() as Array<{id:string;current_destination_url:string}>;
  if(!rows[0]) return new Response('QR code not found',{status:404});
  await fetch(`${env.SUPABASE_URL}/rest/v1/scan_log`,{method:'POST',headers:{...headers,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({dynamic_code_id:rows[0].id})});
  return Response.redirect(rows[0].current_destination_url,302);
};
