// Vercel serverless function to proxy uploads to Cloudflare Stream
// IMPORTANT: bodyParser is disabled so multipart data streams correctly

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      errors: [{ message: 'Method not allowed' }]
    });
  }

  try {
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/stream`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.CF_STREAM_TOKEN}`
          // ❌ DO NOT set Content-Type manually
        },
        body: req
      }
    );

    const text = await cfResponse.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = { success: false, errors: [{ message: text }] };
    }

    if (!cfResponse.ok || !data.success) {
      return res.status(cfResponse.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Cloudflare upload error:', err);
    return res.status(500).json({
      success: false,
      errors: [{ message: err.message || 'Internal server error' }]
    });
  }
}
