/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/career", destination: "/", permanent: true },
      { source: "/careers", destination: "/", permanent: true },
    ];
  },
  onDemandEntries: {
    // Keep compiled pages in memory longer so switching between the
    // handful of sidebar routes (dashboard/companies/skills/progress)
    // doesn't force a recompile each time.
    maxInactiveAge: 60 * 60 * 1000,
    pagesBufferLength: 10,
  },
};

module.exports = nextConfig;
