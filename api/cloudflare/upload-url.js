// Vercel serverless function to upload a video to Cloudflare Stream from an external URL.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, errors: [{ message: 'Method not allowed' }] });
  }
  try {
    const { url, metadata } = req.body || {};
    if (!url) {
      return res.status(400).json({ success: false, errors: [{ message: 'Missing url in request body' }] });
    }
    // Use environment variable if available; otherwise fallback to known account ID.
    const accountId = process.env.CF_ACCOUNT_ID || '13faa7514f6b0dfd763ca79c8a3cc3f4';
    const streamToken = process.env.CF_STREAM_TOKEN;
    if (!streamToken) {
      return res.status(500).json({ success: false, errors: [{ message: 'Cloudflare Stream token not configured (CF_STREAM_TOKEN)' }] });
    }
    const body = { url };
    if (metadata?.title) {
      body.meta = { name: metadata.title };
    }
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/copy`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${streamToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );
    const data = await cfResponse.json();
    if (!cfResponse.ok || !data.success) {
      return res.status(cfResponse.status).json(data);
    }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ success: false, errors: [{ message: err.message }] });
  }
}
