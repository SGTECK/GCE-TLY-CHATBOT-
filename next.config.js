/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Knowledge/FAQ JSON files are read at request time from /data via fs,
  // not bundled as static imports, so they can be refreshed by the crawler
  // without a rebuild. See lib/knowledgeStore.ts.
};

module.exports = nextConfig;
