import * as fs from 'fs-extra';
import * as httpProxyMiddleware from 'http-proxy-middleware';
import * as _ from 'lodash';
import * as Config from 'webpack-chain';
import * as merge from 'webpack-merge';

// import * as commander from 'commander';
import paths from './config/paths';

import Scripts from './scripts';

export interface IPluginObject {
  [key: string]: any;
}

export type Command = 'start' | 'build';

export interface IPluginOptions {
  isServer: boolean;
  args: IArgs;
}

export type AppConfigPlugin<T> = (options: IPluginOptions, webpackConfig: T) => T;

export type ConfigureWebpack = IPluginObject | AppConfigPlugin<IPluginObject>;
export interface IArgs {
  ssr?: boolean;
  mode?: string;
  open?: boolean;
}

export interface IProxyOptions {
  [key: string]: httpProxyMiddleware.Config;
}

export interface IProjectOptions {
  configureWebpack?: ConfigureWebpack;
  clientIndexJs: string;
  serverIndexJs: string;
  chainWebpack?: AppConfigPlugin<Config>;
  plugins?: string[];
  port?: string;
  host?: string;
  proxy?: IProxyOptions;
}

const webpackMerge = merge;

export default class Service {
  public projectOptions!: IProjectOptions;
  public webpackChainFns: AppConfigPlugin<Config>[] = [];
  public webpackRawConfigFns: ConfigureWebpack[] = [];
  public webpackConfig: any;

  public script = new Scripts(this);

  constructor() {
    // this.options = {
    //   ...options,
    //   ...this.initOptions
    // };
  }

  public resolveChainableWebpackConfig (isServer: boolean, args: IArgs) {
    const chainableConfig = new Config();
    // apply chains
    this.webpackChainFns.forEach(fn => fn({ isServer, args }, chainableConfig));
    return chainableConfig;
  }

  public resolveWebpackConfig = (
    webpackConfig: any = {},
    isServer: boolean,
    args: IArgs,
  ) => {
    const chainableConfig = this.resolveChainableWebpackConfig(isServer, args);
    let config = chainableConfig.toConfig();
    const original = config;
    config = webpackMerge(webpackConfig, original);
    this.webpackRawConfigFns.forEach((fn) => {
      if (typeof fn === 'function') {
        const res = (fn as any)({ isServer, args }, config);
        if (res) {
          config = webpackMerge(config, res);
        }
      } else if (fn instanceof Object) {
        config = webpackMerge(config, fn);
      }
    });
    if (config !== original) {
      cloneRuleNames(
        config.module && config.module.rules,
        original.module && original.module.rules
      );
    }
    return config;
  }

  public run = (command: Command, args: IArgs) => {
    this.projectOptions = this.getUserOptions();
    if (this.projectOptions.chainWebpack) {
      this.webpackChainFns.push(this.projectOptions.chainWebpack);
    }
    if (this.projectOptions.plugins instanceof Array) {
      this.projectOptions.plugins.forEach((plugin) => {
        if (typeof(plugin) === 'string') {
          const completePluginName = `radish-plugin-${plugin}`;
          const fn = require(`${process.cwd()}/node_modules/${completePluginName}`).default;
          if (fn) {
            this.webpackRawConfigFns.push(fn);
          } else {
            throw new Error(`Unable to find '${completePluginName}`);
          }
        } else if (typeof(plugin) === 'function') {
          this.webpackRawConfigFns.push(plugin);
        }
      });
    }
    if (this.projectOptions.configureWebpack) {
      this.webpackRawConfigFns.push(this.projectOptions.configureWebpack);
    }
    this.script.run(command, args);
  }

  public create = (projectName: string) => {
    this.script.create(projectName);
  }

  public getUserOptions = () => {
    const initConfig = {
      host: 'localhost',
      port: '3000',
      clientIndexJs: paths.appClientIndexJs,
      serverIndexJs: paths.appServerIndexJs,
    };
    if (fs.existsSync(paths.appConfig)) {
      try {
        const config = require(paths.appConfig);
        return { ...initConfig, ...config };
      } catch (e) {
        console.error('Invalid config.js file.', e);
        process.exit(1);
      }
    }
  }
}

function cloneRuleNames(to: any, from: any) {
  if (!to || !from) {
    return;
  }
  from.forEach((r: any, i: number) => {
    if (to[i]) {
      Object.defineProperty(to[i], '__ruleNames', {
        value: r.__ruleNames
      });
      cloneRuleNames(to[i].oneOf, r.oneOf);
    }
  });
}
