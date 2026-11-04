const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

/** @type {(env: unknown, argv: { mode?: string }) => import('webpack').Configuration} */
module.exports = (_env, argv) => {
  const isProd = argv.mode === 'production';
  return {
    entry: './src/client/index.jsx',
    output: {
      path: path.resolve(__dirname, 'dist/public'),
      filename: isProd ? 'assets/[name].[contenthash:8].js' : 'assets/[name].js',
      // Relative so the build works under the GitHub Pages sub-path
      publicPath: isProd ? './' : '/',
      clean: true,
    },
    resolve: { extensions: ['.jsx', '.js', '.tsx', '.ts'] },
    module: {
      rules: [
        // ts-loader compiles JSX too (allowJs), so no Babel setup is needed
        { test: /\.[jt]sx?$/, use: { loader: 'ts-loader', options: { transpileOnly: true } }, exclude: /node_modules/ },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({ template: './src/client/index.html' }),
      // Base URL of the Feishu auth Worker. Empty disables the Feishu panel.
      new webpack.DefinePlugin({
        'process.env.FEISHU_AUTH_URL': JSON.stringify(process.env.FEISHU_AUTH_URL ?? (isProd ? '' : 'http://localhost:8787')),
      }),
    ],
    // The app embeds large base64 artwork, so the bundle is intentionally big
    performance: { hints: false },
    devtool: isProd ? false : 'eval-source-map',
    devServer: {
      port: 3000,
      historyApiFallback: true,
    },
  };
};
