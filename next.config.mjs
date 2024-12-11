import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config) => {
        config.resolve.alias['hexoid'] = path.resolve('node_modules/hexoid/dist/index.js');
        return config;
      }
};

export default nextConfig;
