/** @type {import('next').NextConfig} */
const nextConfig = {
  // https://github.com/vercel/next.js/discussions/59105#discussioncomment-8223381
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: process.env.APP_URL || "",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
