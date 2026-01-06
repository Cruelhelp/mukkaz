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
    // Use the environment variable if available; otherwise fall back to a known account ID.
    const accountId = process.env.CF_ACCOUNT_ID || '13faa7514f6b0dfd763ca79c8a3cc3f4';
    const streamToken = process.env.CF_STREAM_TOKEN;
    if (!streamToken) {
      return res.status(500).json({
        success: false,
        errors: [{
          message: 'Cloudflare Stream token not configured (CF_STREAM_TOKEN). Upload will fall back to Supabase Storage. See CLOUDFLARE_SETUP.md for configuration instructions.'
        }]
      });
    }
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${streamToken}`
          // ❌ DO NOT set Content-Type manually
        },
        duplex: 'half',
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
      // Add helpful error context
      const errorMessage = data.errors?.[0]?.message || 'Cloudflare Stream upload failed';
      console.error('Cloudflare API Error:', {
        status: cfResponse.status,
        message: errorMessage,
        data: data
      });

      return res.status(cfResponse.status).json({
        ...data,
        errors: [{
          message: `Authorization Failure: The authentication credentials are not authorized to perform the request. Verify the credentials and try again.`
        }]
      });
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
