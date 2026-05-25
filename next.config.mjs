/** @type {import('next').NextConfig} */
const nextConfig = {
  headers: async () => [
    {
      source: '/sw.js',
      headers: [{ key: 'Cache-Control', value: 'no-cache' }],
    },
  ],
}

export default nextConfig
