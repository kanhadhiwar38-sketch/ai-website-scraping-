/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@webrecon/types", "@webrecon/shared", "@webrecon/firebase"],
};

export default nextConfig;
