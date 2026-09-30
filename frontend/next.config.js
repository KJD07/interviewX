/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/career", destination: "/", permanent: true },
      { source: "/careers", destination: "/", permanent: true },
      { source: "/enterprise/partner", destination: "/partner", permanent: true },
      { source: "/solutions/ai-technical-interviews", destination: "/blogs/ai-technical-interview", permanent: true },
      { source: "/solutions/ai-coding-interviews", destination: "/blogs/ai-coding-interview", permanent: true },
      { source: "/solutions/interview-proctoring", destination: "/blogs/interview-proctoring", permanent: true },
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
