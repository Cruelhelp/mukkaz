// Cloudflare Stream API Configuration
const CLOUDFLARE_CONFIG = {
  // Your Cloudflare Account ID (find in Cloudflare dashboard)
  accountId: '13faa7514f6b0dfd763ca79c8a3cc3f4',

 

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

