// Cloudflare Stream API Configuration
// Expose configuration on the global window object instead of using a module-scoped constant.
// This ensures other scripts (e.g. cloudflare-stream.js) can access
// CLOUDFLARE_CONFIG via `window.CLOUDFLARE_CONFIG`. Only the accountId is
// exposed client-side. The API token is kept server-side in Vercel env vars.

window.CLOUDFLARE_CONFIG = {
  // Your Cloudflare Account ID (find in Cloudflare dashboard)
  accountId: '13faa7514f6b0dfd763ca79c8a3cc3f4',

  // Base URL for Cloudflare Stream API. This is not used client-side for
  // uploads anymore because we proxy via serverless API routes. It's provided
  // here for completeness if you need to generate API URLs (e.g., for
  // embed, delete, etc.).
  streamApiUrl: 'https://api.cloudflare.com/client/v4/accounts',

  // Upload API endpoint
  get uploadUrl() {
    return `${this.streamApiUrl}/${this.accountId}/stream`;
  },

  // Get video details endpoint
  getVideoUrl(videoId) {
    return `${this.streamApiUrl}/${this.accountId}/stream/${videoId}`;
  },

  // Delete video endpoint
  deleteVideoUrl(videoId) {
    return `${this.streamApiUrl}/${this.accountId}/stream/${videoId}`;
  },

  // Stream embed URL (legacy, may be unused)
  getEmbedUrl(videoId) {
    return `https://embed.cloudflarestream.com/${videoId}/iframe`;
  },

  // Stream player script (legacy, may be unused)
  getPlayerScript(videoId) {
    return `https://embed.cloudflarestream.com/${videoId}/embed.js`;
  }
};

