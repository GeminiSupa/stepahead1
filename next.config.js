/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'stepaheadinclusive.com',
      },
    ],
  },
}

module.exports = nextConfig
