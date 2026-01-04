// Vercel serverless function to delete a Cloudflare Stream video.

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ success: false, errors: [{ message: 'Missing video id' }] });
  }
  try {
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/stream/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${process.env.CF_STREAM_TOKEN}`
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