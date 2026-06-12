/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.nationalbeef.com',
      },
    ],
  },
};

export default nextConfig;
