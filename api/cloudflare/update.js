// Vercel serverless function to update Cloudflare Stream video metadata.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, errors: [{ message: 'Method not allowed' }] });
  }
  try {
    const { videoId, metadata } = req.body || {};
    if (!videoId) {
      return res.status(400).json({ success: false, errors: [{ message: 'Missing videoId in request body' }] });
    }
    // Build body for Cloudflare API
    const body = {};
    if (metadata?.title) {
      body.meta = { name: metadata.title };
    }
    if (metadata?.requireSignedURLs !== undefined) {
      body.requireSignedURLs = metadata.requireSignedURLs;
    }
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/stream/${encodeURIComponent(videoId)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.CF_STREAM_TOKEN}`,
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