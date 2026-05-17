/** @type {import('next').NextConfig} */
const withLess = require("next-with-less");

if (!process.env.NEXT_TELEMETRY_DISABLED) {
  process.env.NEXT_TELEMETRY_DISABLED = "1";
}
if (!process.env.NEXT_IGNORE_INCORRECT_LOCKFILE) {
  process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = "1";
}

const nextConfig = {
  reactStrictMode: true,
};

module.exports = withLess({
  ...nextConfig,
  lessLoaderOptions: {
    lessOptions: {
      javascriptEnabled: true,
    },
  },
});
