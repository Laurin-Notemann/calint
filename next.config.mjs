import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias['hexoid'] = path.resolve('node_modules/hexoid/dist/index.js');
    return config;
  },
  async headers() {
    return [
      {
        source: '/pipedrive-frame/side-panel',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOW-FROM https://*.pipedrive.com'
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://*.pipedrive.com"
          }
        ],
      },
      {
        source: '/pipedrive-frame/settings',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOW-FROM https://*.pipedrive.com'
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://*.pipedrive.com"
          }
        ],
      },
      {
        source: '/pipedrive-frame/settings-modal',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOW-FROM https://*.pipedrive.com'
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://*.pipedrive.com"
          }
        ],
      },
    ];
  }
};

export default nextConfig;
