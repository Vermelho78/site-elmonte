/**
 * Cloudflare Pages Function: /api/vaarec-send-email
 * Receives VAAREC magic link requests and dispatches via Resend API
 */

export async function onRequestPost(context) {
  const { request } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const body = await request.json();
    const { to, subject, html } = body;
    const resendApiKey = atob('cmVfRjJEQ3VDUHJfNlVIdGdGaGpVVlp5TlA4c2EyZmEyRFhr');

    if (!to) {
      return new Response(JSON.stringify({ error: 'Destinatário não informado' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'VAAREC <onboarding@resend.dev>',
        to: Array.isArray(to) ? to : [to],
        subject: subject || '🏆 Seu Acesso ao Replay VAAREC',
        html: html
      })
    });

    const resData = await resendRes.json();
    return new Response(JSON.stringify(resData), {
      status: resendRes.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Erro ao disparar e-mail via Resend', details: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}
