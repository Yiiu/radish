import * as CaseSensitivePathPlugin from 'case-sensitive-paths-webpack-plugin';
import * as ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin-alt';
import * as FriendlyErrorsWebpackPlugin from 'friendly-errors-webpack-plugin';
import * as fs from 'fs';
import * as HardSourceWebpackPlugin from 'hard-source-webpack-plugin';
import * as path from 'path';
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin';
import * as webpack from 'webpack';

const WriteFilePlugin = require('write-file-webpack-plugin');
const CircularDependencyPlugin = require('circular-dependency-plugin');
const typescriptFormatter = require('react-dev-utils/typescriptFormatter');

import paths from '../paths';

import Service, { IArgs } from '../../Service';
import { getEnv } from '../env';
import scriptLoader from './loader/script';
import styleLoader from './loader/style';

const appDirectory = fs.realpathSync(process.cwd());
const nodePath = (process.env.NODE_PATH || '')
  .split(path.delimiter)
  .filter(folder => folder && !path.isAbsolute(folder))
  .map(folder => path.resolve(appDirectory, folder))
  .join(path.delimiter);

const dev = process.env.NODE_ENV === 'development';

export default (isServer: boolean, service: Service, args: IArgs) => {
  const { projectOptions } = service;
  const { hardSource, ssr, noTs, host, port, css, electron } = projectOptions;
  const dotenv = getEnv(isServer, projectOptions, '');

  const webpackMode = process.env.NODE_ENV;
  let publicPath = '';
  if (ssr) {
    publicPath = '/public/';
  } else {
    if (electron) {
      publicPath = '';
    } else {
      publicPath = '/';
    }
  }
  let webpackConfig = {
    mode: webpackMode as any,
    devtool: 'source-map',
    context: process.cwd(),
    cache: true,
    output: {
      publicPath,
      hotUpdateChunkFilename: 'static/webpack/[id].[hash].hot-update.js',
      hotUpdateMainFilename: 'static/webpack/[hash].hot-update.json',
    },
    optimization: !dev ? {
      splitChunks: {
        cacheGroups: {
          commons: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor',
            chunks: 'all'
          }
        }
      }
    } : {},
    resolveLoader: {
      modules: [
        path.resolve(__dirname, '../../../node_modules'),
        paths.appNodeModules,
      ],
    },
    resolve: {
      extensions: ['.wasm', '.mjs', '.js', '.jsx', '.ts', '.tsx', '.json'],
      alias: !isServer ? {
        'react-dom': '@hot-loader/react-dom',
        // 'webpack-hot-middleware/client': require.resolve('webpack-hot-middleware/client'),
      } : {},
      modules: [
        path.resolve(__dirname, '../../../../node_modules'),
        paths.appNodeModules,
      ].concat(
        // It is guaranteed to exist because we tweak it in `env.js`
        nodePath.split(path.delimiter).filter(Boolean),
      ),
      plugins: [
        !noTs && new TsconfigPathsPlugin({
          configFile: paths.appTsConfig
        }),
      ].filter(Boolean),
    },
    module: {
      rules: [
        {
          oneOf: [
            styleLoader({ isServer, css }),
            css.cssModules && styleLoader({ isServer, css }, true),
            scriptLoader({ isServer }),
            {
              test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/],
              loader: require.resolve('url-loader'),
              options: {
                limit: 10000,
                name: 'static/media/[name].[hash:8].[ext]',
              },
            },
            {
              test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
              loader: require.resolve('file-loader'),
              options: {
                limit: 10000,
                name: 'static/fonts/[name].[hash:7].[ext]',
                publicPath: process.env.NODE_ENV === 'production' ? '../../' : '/'
              }
            },
            {
              exclude: [/\.(js|jsx|mjs|tsx?)$/, /\.html$/, /\.json$/],
              loader: require.resolve('file-loader'),
              options: {
                name: 'static/media/[name].[hash:8].[ext]',
              },
            },
          ].filter(Boolean)
        }
      ],
    },
    plugins: [
      new CircularDependencyPlugin({
        exclude: /node_modules/
      }),
      new webpack.DefinePlugin(dotenv.stringified),
      new webpack.NamedModulesPlugin(),
      dev && hardSource && new HardSourceWebpackPlugin(),
      dev && new webpack.HotModuleReplacementPlugin(),
      dev && new CaseSensitivePathPlugin(),
      dev && ssr && new WriteFilePlugin({
        exitOnErrors: false,
        log: false,
        // required not to cache removed files
        useHashIndex: false,
      }),
      // dev && new WebpackBar({
      //   name: isServer ? 'server' : 'client',
      // }),
      dev && new FriendlyErrorsWebpackPlugin({
        compilationSuccessInfo: {
          messages: [`Your application is running at at http://${host}:${port}`],
          notes: []
        },
        clearConsole: true,
      }),
      !noTs && !isServer && new ForkTsCheckerWebpackPlugin({
        // silent: true,
        async: dev,
        reportFiles: [
          '**',
          '!**/*.json',
          '!**/__tests__/**',
          '!**/?(*.)(spec|test).*',
          '!**/src/setupProxy.*',
          '!**/src/setupTests.*',
        ],
        logger: {
          error: console.error,
          warn: console.warn,
          info: () => {},
        },
        watch: paths.appSrc,
        checkSyntacticErrors: true,
        formatter: dev ? typescriptFormatter : undefined,
        tsconfig: paths.appTsConfig,
      }),
    ].filter(Boolean)
  };
  webpackConfig = service.resolveWebpackConfig(webpackConfig, isServer, args) as any;
  return webpackConfig;
};
