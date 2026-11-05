const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

/** @type {(env: unknown, argv: { mode?: string }) => import('webpack').Configuration} */
module.exports = (_env, argv) => {
  const isProd = argv.mode === 'production';
  return {
    entry: './src/client/index.jsx',
    output: {
      path: path.resolve(__dirname, 'dist/public'),
      filename: isProd ? 'assets/[name].[contenthash:8].js' : 'assets/[name].js',
      publicPath: '/',
      clean: true,
    },
    resolve: { extensions: ['.jsx', '.js', '.tsx', '.ts'] },
    module: {
      rules: [
        // ts-loader compiles JSX too (allowJs), so no Babel setup is needed
        { test: /\.[jt]sx?$/, use: { loader: 'ts-loader', options: { transpileOnly: true } }, exclude: /node_modules/ },
        // Email images (src/client/email) are emitted as plain files at stable paths, because
        // pasted signatures keep linking to them for years. Replacing a file keeps its URL.
        { test: /\.(png|jpe?g)$/i, type: 'asset/resource', generator: { filename: 'email/[name][ext]' } },
      ],
    },
    plugins: [new HtmlWebpackPlugin({ template: './src/client/index.html' })],
    // The app embeds large base64 artwork, so the bundle is intentionally big
    performance: { hints: false },
    devtool: isProd ? false : 'eval-source-map',
  };
};
