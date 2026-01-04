// Vercel serverless function to delete a Cloudflare Stream video.

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ success: false, errors: [{ message: 'Missing video id' }] });
  }

  try {
    // Use environment variable if available; otherwise fallback to known account ID.
    const accountId = process.env.CF_ACCOUNT_ID || '13faa7514f6b0dfd763ca79c8a3cc3f4';
    const streamToken = process.env.CF_STREAM_TOKEN;
    if (!streamToken) {
      return res.status(500).json({ success: false, errors: [{ message: 'Cloudflare Stream token not configured (CF_STREAM_TOKEN)' }] });
    }

    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${streamToken}`
        }
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
