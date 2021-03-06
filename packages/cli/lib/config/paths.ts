import * as fs from 'fs';
import * as path from 'path';
import config from './index';

const appDirectory = fs.realpathSync(process.cwd());
const resolveApp = (relativePath: string) => path.resolve(appDirectory, relativePath);

export default {
  dotenv: resolveApp('.env'),
  appPath: resolveApp('.'),
  appSrc: resolveApp('src'),
  yarnLockFile: resolveApp('yarn.lock'),
  appPackageJson: resolveApp('package.json'),
  appClientIndexJs: resolveApp('src/app/index.tsx'),
  appServerIndexJs: resolveApp('src/server.ts'),
  appPublic: resolveApp('public'),
  appHtml: resolveApp('public/index.html'),
  appNodeModules: resolveApp('node_modules'),
  appStyles: resolveApp('src/app/styles'),
  appBuild: config.build,
  appBuildPublic: resolveApp(`${config.build}`),
  appBuildSrc: resolveApp(config.build),
  appBabelRc: resolveApp('.babelrc'),
  appTsConfig: resolveApp('tsconfig.json'),
  assetManifest: resolveApp(`${config.build}/asset-manifest.json`),
  assetLoadable: resolveApp(`${config.build}/react-loadable.json`),
  appConfig: resolveApp('config.js'),
};
