interface Env { STRIPE_SECRET_KEY: string; STRIPE_PRICE_ID: string; PUBLIC_SITE_URL: string }
export const onRequest: PagesFunction<Env> = async ({request,env}) => {
  if(request.method !== 'POST' && request.method !== 'GET') return new Response('Method not allowed',{status:405});
  const body = new URLSearchParams({mode:'subscription','line_items[0][price]':env.STRIPE_PRICE_ID,'line_items[0][quantity]':'1','success_url':`${env.PUBLIC_SITE_URL}/dashboard?checkout=success`,'cancel_url':`${env.PUBLIC_SITE_URL}/pricing`});
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'Content-Type':'application/x-www-form-urlencoded'},body});
  if(!response.ok) return new Response('Checkout unavailable',{status:502});
  const session = await response.json() as {url?:string};
  return Response.redirect(session.url || `${env.PUBLIC_SITE_URL}/pricing`,303);
};
