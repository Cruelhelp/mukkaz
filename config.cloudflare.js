// Cloudflare Stream API Configuration
const CLOUDFLARE_CONFIG = {
  // Your Cloudflare Account ID (find in Cloudflare dashboard)
  accountId: '13faa7514f6b0dfd763ca79c8a3cc3f4',

  // API Token for Cloudflare Stream
  apiToken: '2bda8cd2c066d9e93e92cb13dfb6af12ef3f7',

  // Stream API Base URL
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

  // Stream embed URL
  getEmbedUrl(videoId) {
    return `https://embed.cloudflarestream.com/${videoId}/iframe`;
  },

  // Stream player script
  getPlayerScript(videoId) {
    return `https://embed.cloudflarestream.com/${videoId}/embed.js`;
  }
};
