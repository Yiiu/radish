import chalk from 'chalk';
import * as spawn from 'cross-spawn';
import * as ejs from 'ejs';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as inquirer from 'inquirer';
import * as path from 'path';

import { promiseLogger } from '../../utils/promiseLogger';

type Framework = 'koa' | 'express';
type Type = 'ssr' | 'spa';

interface ITemplateArgs {
  framework?: Framework;
  type: Type;
  projectName: string;
  isTypescript: boolean;
}

export interface ICreateOptions {
  template?: string;
  spa?: boolean;
  plugin?: boolean;
  npm?: boolean;
}

const cwd = process.cwd();

function isTsFile(file: string) {
  return file.endsWith('.ts')
    || file.endsWith('.tsx')
    || [
      'tsconfig.json',
      'typings.d.ts',
    ].includes(file);
}
export default class Create {

  public projectName: string;
  public options: ICreateOptions;
  public name!: string;
  public targetDir!: string;
  public inCurrent!: boolean;
  public templatePath!: string;
  public template!: {
    template: string;
    files: string[];
    public: string[];
  };
  public useYarn: boolean;

  constructor(projectName: string, options: ICreateOptions = {}) {
    this.projectName = projectName;
    this.options = options;
    this.useYarn = options.npm ? false : this.shouldUseYarn();
    this.getInfo(this.projectName);
  }

  public getInfo = (projectName: string) => {
    this.inCurrent = projectName === '.';
    this.name = this.inCurrent ? path.relative('../', cwd) : projectName;
    this.targetDir = path.resolve(cwd, projectName || '.');
    // this.getTemplatePath();
  }

  public getTemplatePath = (args: ITemplateArgs) => {
    let dir;
    if (process.env.DEV === 'development') {
      dir = require('../../../../../template').dir;
    } else {
      dir = require('@reslow/template').dir;
    }
    if (args.type === 'spa') {
      if (args.isTypescript) {
        this.templatePath = path.join(dir, '/spa');
      } else {
        this.templatePath = path.join(dir, '/spa-javascript');
      }
    } else {
      if (args.isTypescript) {
        this.templatePath = path.join(dir, '/default');
      } else {
        this.templatePath = path.join(dir, '/javascript');
      }
    }
    if (!fs.existsSync(this.templatePath)) {
      this.exit('Failed to get template, template not found');
    } else {
      this.template = this.templateConfigAndFile();
    }
  }

  public copyTemplate = async (args: ITemplateArgs) => {
    await this.getTemplateFiles(args);
  }

  public getTemplateFiles = async (args: ITemplateArgs) => {
    const { targetDir, templatePath, template: templateConfig } = this;
    const data = glob.sync('**/*', {
      cwd: path.join(templatePath, templateConfig.template),
      dot: true,
    });
    const fileList = data.filter((file) => {
      if (args.isTypescript) {
        if ((file.endsWith('.js') || file.endsWith('.jsx')) && file !== 'config.js') {
          return false;
        }
      } else {
        if (file === 'tsconfig.json') {
          return false;
        }
        return !isTsFile(file);
      }
      if (!templateConfig.public.every(v => v !== file)) {
        return false;
      }
      return true;
    });
    await Promise.all(
      [
        ...fileList.map(async (src: string) => {
          const file = path.join(templatePath, templateConfig.template, src);
          if (!fs.statSync(file).isFile()) {
            return;
          }
          const fileContent = await fs.readFile(file, 'utf8');
          let finalTemplate;
          try {
            const content = ejs.render(fileContent, Object.assign({}, args));
            finalTemplate = `${content.trim()}\n`;
          } catch (err) {
            throw new Error(`Could not compile template ${file}: ${err.message}`);
          }
          await fs.outputFile(path.join(targetDir, src), finalTemplate, {
            encoding: 'utf8'
          });
        }),
        ...templateConfig.public.map(async (src: string) => {
          const file = path.join(templatePath, templateConfig.template, src);
          await fs.copy(file, path.join(targetDir, src));
        })
      ]
    );
  }

  public templateConfigAndFile = () => {
    const { templatePath } = this;
    const configFile = path.join(templatePath, 'config.json');
    if (!fs.existsSync(configFile)) {
      this.exit('template config error');
    }
    const config = require(configFile);
    return config;
  }

  public prompt = async <T>(questions: inquirer.QuestionCollection<any>): Promise<T> => {
    const { value } = await inquirer.prompt<{ value: T }>(questions);
    return value;
  }

  public exit = (message: string) => {
    console.error(`\n ${chalk.red(message)} \n`);
    process.exit(1);
  }

  public getPromptArgs = async () => {
    const args: ITemplateArgs = {
      type: 'ssr',
      projectName: this.projectName,
      isTypescript: true
    };
    args.projectName = await this.prompt<Type>({
      type: 'input',
      name: 'value',
      message: 'Input project name.',
      default: args.projectName
    });
    args.type = await this.prompt<Type>({
      type: 'list',
      name: 'value',
      message: 'Select template type.',
      choices: [
        {
          name: 'server side render',
          value: 'ssr'
        },
        {
          name: 'spa',
          value: 'spa'
        }
      ],
      default: 'ssr'
    });
    args.isTypescript = await this.prompt<boolean>({
      type: 'confirm',
      name: 'value',
      message: 'Do you want to use typescript?',
      default: true
    });
    if (args.type === 'ssr') {
      args.framework = await this.prompt<Framework>({
        type: 'list',
        name: 'value',
        message: 'Select server web framework.',
        choices: [
          'koa',
          'express',
        ],
        default: 'koa'
      });
    }
    return args;
  }

  public create = async () => {
    const { targetDir } = this;
    console.log(`\n Creating a new React app in ${chalk.green(targetDir)}. \n`);
    await promiseLogger(await this.ensureDir(), 'Check the create folder.');
    const args = await this.getPromptArgs();
    await promiseLogger(this.getTemplatePath(args), 'Get template folder.');
    await promiseLogger(this.copyTemplate(args), 'Copy template folder.');
    this.installModules();
  }

  public ensureDir = async () => {
    const { targetDir, name, inCurrent } = this;
    if (fs.existsSync(targetDir)) {
      console.log(
        ` Uh oh! Looks like there's already a directory called ${chalk.red(
          name,
        )}.`,
      );
      if (inCurrent) {
        const { ok } = await inquirer.prompt<{ok: boolean}>({
          type: 'confirm',
          name: 'ok',
          message: 'Generate project in current directory?',
        });
        if (!ok) {
          this.exit('');
        }
      } else {
        const { ok } = await inquirer.prompt<{ok: boolean}>({
          type: 'confirm',
          name: 'ok',
          message: 'The folder already exists, is it deleted?',
        });
        if (!ok) {
          this.exit('');
        }
      }
    }
    fs.emptyDirSync(targetDir);
  }

  public shouldUseYarn = () => {
    try {
      spawn.sync('yarnpkg --version', { stdio: 'ignore' });
      return true;
    } catch (e) {
      return false;
    }
  }

  public installModules = () => {
    const { targetDir, useYarn, name, inCurrent } = this;
    // const dependencies = this.getInstallPackage();
    process.chdir(targetDir);
    let command: string;
    let args: string[] = [];
    if (useYarn) {
      command = 'yarnpkg';
      // if (dependencies.length > 0) {
      //   args.push('--exact');
      // }
      args.push('--cwd');
      args.push(targetDir);
    } else {
      command = 'npm';
      args = [
        'install',
        '--loglevel',
        'error',
      ];
    }
    const child = spawn(command, args, { stdio: 'inherit' });
    console.log(`\n ${chalk.green('Installing packages.')} This might take a couple of minutes.\n`);
    child.on('close', (code) => {
      if (code !== 0) {
        console.log(chalk.red(`error: ${command} ${args.join(' ')}`));
        return;
      }
      console.log();
      console.log(`Success! Created ${chalk.green(name)} at ${chalk.green(targetDir)}`);
      console.log('Inside that directory, you can run several commands:');
      console.log();
      console.log(chalk.cyan(`  ${useYarn ? 'yarn' : 'npm'} start`));
      console.log('    Starts the development server.');
      console.log();
      console.log(
        chalk.cyan(
          `  ${useYarn ? 'yarn' : 'npm'} ${useYarn ? '' : 'run'} build`,
        ),
      );
      console.log('    Bundles the app into static files for production.');
      console.log();
      console.log('We suggest that you begin by typing:');
      console.log();
      if (!inCurrent) {
        console.log(chalk.cyan('  cd'), name);
      }
      console.log(`  ${chalk.cyan(`${useYarn ? 'yarn' : 'npm'} start`)}\n`);
    });
  }

  public getInstallPackage = () => {
    let allDependencies = [
      '@types/react',
      '@types/react-dom',
      'react-dom',
      'react',
      '@reslow/cli',
      'react-hot-loader',
    ];
    if (!this.options.spa) {
      allDependencies = allDependencies.concat(['@types/express', 'express']);
    } else {
      allDependencies.unshift('@types/node');
    }
    if (this.options.plugin) {
      return [];
    }
    return allDependencies;
  }
}
