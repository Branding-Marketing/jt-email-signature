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
      ],
    },
    plugins: [new HtmlWebpackPlugin({ template: './src/client/index.html' })],
    // The app embeds large base64 artwork, so the bundle is intentionally big
    performance: { hints: false },
    devtool: isProd ? false : 'eval-source-map',
  };
};
