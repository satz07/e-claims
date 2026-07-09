/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack(config, { isServer }) {
    config.module.rules.push({
      test: /node_modules\/thread-stream\/.*\.(test|bench|md|LICENSE|sh|yml|zip|ts|mjs)$/,
      loader: 'ignore-loader',
    });

    // Silence @react-native-async-storage missing module (MetaMask SDK browser build)
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
    };

    // Suppress baseline-browser-mapping staleness warning
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      /baseline-browser-mapping/,
    ];

    return config;
  },
};

export default nextConfig;
