import * as CopyWebpackPlugin from 'copy-webpack-plugin';
import * as HtmlWebpackPlugin from 'html-webpack-plugin';
import * as MiniCssExtractPlugin from 'mini-css-extract-plugin';
import * as OptimizeCssAssetsWebpackPlugin from 'optimize-css-assets-webpack-plugin';
import * as path from 'path';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import * as ManifestPlugin from 'webpack-manifest-plugin';
import * as merge from 'webpack-merge';

import Service, { IArgs } from '../../Service';
import paths from '../paths';
import baseConfig from './base';

const errorOverlayMiddleware = require('react-dev-utils/errorOverlayMiddleware');
const AutoDllPlugin = require('autodll-webpack-plugin');
const ModuleNotFoundPlugin = require('react-dev-utils/ModuleNotFoundPlugin');
const InterpolateHtmlPlugin = require('react-dev-utils/InterpolateHtmlPlugin');
const CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');
const WatchMissingNodeModulesPlugin = require('react-dev-utils/WatchMissingNodeModulesPlugin');
const ErrorOverlayPlugin = require('error-overlay-webpack-plugin')

const dev = process.env.NODE_ENV === 'development';

export default (service: Service, args: IArgs) => {
  const { projectOptions } = service;
  const { host, clientIndexJs, autoDll, devPort, proxy, analyze, ssr, quiet, electron } = projectOptions;
  const clientConfig = {
    entry: [
      // dev && `webpack-dev-server/client?http://${host}:${devPort}`,
      // dev && 'webpack/hot/only-dev-server',
      // dev && 'react-dev-utils/webpackHotDevClient',
      dev && 'react-hot-loader/patch',
      clientIndexJs
    ].filter(Boolean),
    output: {
      path: path.join(paths.appBuildSrc, ''),
      filename: 'static/chunks/app.[hash].js',
      libraryTarget: 'jsonp',
      chunkFilename: 'static/chunks/[name].[contenthash].js',
    },
    devServer: {
      proxy,
      host,
      quiet,
      overlay: true,
      port: devPort,
      compress: true,
      clientLogLevel: 'none',
      disableHostCheck: true,
      historyApiFallback: {
        disableDotRule: true
      },
      watchOptions: {
        ignored: /node_modules/,
      },
      hot: true,
      noInfo: true,
      contentBase: paths.appBuildSrc,
      publicPath: ssr ? '/.reslow' : '/',
      before(app: any, _server: any) {
        // app.use(evalSourceMapMiddleware(server));
        app.use(errorOverlayMiddleware());
        // app.use(noopServiceWorkerMiddleware());
      },
    },
    plugins: [
      !dev && new OptimizeCssAssetsWebpackPlugin({
        cssProcessorOptions: {
          safe: true,
          discardComments: {
            removeAll: true
          }
        }
      }),
      !ssr && new HtmlWebpackPlugin({
        inject: true,
        template: paths.appHtml,
      }),
      !ssr && new InterpolateHtmlPlugin(HtmlWebpackPlugin, {
        PUBLIC_URL: ''
      }),
      dev && ssr && new AutoDllPlugin({
        debug: false,
        inject: true,
        filename: '[name].js',
        entry: {
          vendor: autoDll.vendor || [],
          polyfills: autoDll.polyfills || [],
        }
      }),
      // ssr && new ReactLoadablePlugin({
      //   filename: path.join(paths.appBuildSrc, 'react-loadable.json'),
      // }),
      ssr && new ManifestPlugin({
        fileName: 'asset-manifest.json',
        writeToFileEmit: true
      }),
      new MiniCssExtractPlugin({
        filename: 'static/style/[name].css',
        chunkFilename: 'static/style/[id].css',
      }),
      new CopyWebpackPlugin([{
        from: paths.appPublic,
      }]),
      // new SWPrecacheWebpackPlugin({
      //   cacheId: 'client',
      //   dontCacheBustUrlsMatching: false,
      //   filename: 'service-worker.js',
      //   minify: true,
      // } as any),
      analyze && new BundleAnalyzerPlugin({
        defaultSizes: 'gzip',
        generateStatsFile: true,
      }),
      new ErrorOverlayPlugin(),
      new ModuleNotFoundPlugin(paths.appPath),
      dev && new CaseSensitivePathsPlugin(),
      dev && new WatchMissingNodeModulesPlugin(paths.appNodeModules),
    ].filter(Boolean),
    performance: false,
  };
  if (electron) {
    (clientConfig as any).target = 'electron-renderer';
  }
  return merge(baseConfig(false, service, args) as any, clientConfig as any);
};
