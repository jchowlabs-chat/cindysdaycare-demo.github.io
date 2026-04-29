const ALLOWED_ORIGINS = [
  'https://cindysdaycare.com',
  'https://www.cindysdaycare.com',
  'https://cindysdaycare-demo.github.io',
];

function getCorsHeaders(request) {
  const origin = (request && request.headers && request.headers.get('Origin')) || '';
  const allowed = ALLOWED_ORIGINS.find(o => origin === o) || ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: getCorsHeaders(request) });
    }

    if (request.method !== 'POST') {
      return json(request, { error: 'Method not allowed' }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json(request, { error: 'Invalid JSON' }, 400);
    }

    const { name, phone, message } = body;
    if (!name || !phone) {
      return json(request, { error: 'Missing required fields: name and phone' }, 400);
    }

    const text = message
      ? `New tour request from the Cindy's Daycare website.\n\nName: ${name}\nPhone: ${phone}\nMessage: ${message}\n\nPlease follow up to schedule a tour.`
      : `New tour request from the Cindy's Daycare website.\n\nName: ${name}\nPhone: ${phone}\n\nPlease follow up to schedule a tour.`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Cindy's Daycare <onboarding@resend.dev>",
        to: ['jchow@jchowlabs.com'],
        subject: `Tour Request — ${name}`,
        text,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      return json(request, { error: 'Submission failed', detail: err }, 500);
    }

    return json(request, { success: true });
  },
};

function json(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(request), 'Content-Type': 'application/json' },
  });
}
