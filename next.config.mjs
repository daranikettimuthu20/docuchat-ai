/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['unpdf', 'mammoth', 'xlsx', 'officeparser'],
  output: 'standalone',
};

export default nextConfig;
