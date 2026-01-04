// Vercel serverless function to handle direct video uploads to Cloudflare Stream.
// This endpoint proxies the incoming multipart/form-data request to the
// Cloudflare Stream API. Do not expose your API token on the client.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, errors: [{ message: 'Method not allowed' }] });
  }
  try {
    // Forward the raw body (a Readable stream) to Cloudflare. Vercel will
    // stream the body for us without parsing the form data. The API token is
    // set via an environment variable in Vercel settings.
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/stream`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.CF_STREAM_TOKEN}`
        },
        body: req
      }
    );

    const data = await cfResponse.json();
    if (!cfResponse.ok || !data.success) {
      return res.status(400).json(data);
    }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ success: false, errors: [{ message: err.message }] });
  }
}