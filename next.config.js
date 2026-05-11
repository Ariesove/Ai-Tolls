/** @type {import('next').NextConfig} */
const withLess = require("next-with-less");

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
