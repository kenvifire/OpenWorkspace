import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['@openworkspace/ui'],
  turbopack: {
    root: require('path').resolve(__dirname, '../..'),
  },
};

export default withNextIntl(nextConfig);
