#!/usr/bin/env node

import program from 'commander'
import fg from 'fast-glob'
import inquirer from 'inquirer'
import symbols from 'log-symbols'
import chalk from 'chalk'
import ora from 'ora'
import download from 'download-git-repo'
import mkdirp from 'mkdirp'
import rimraf from 'rimraf'

import { copyFileSync, statSync, existsSync } from 'fs'
import { dirname, join } from 'path'

// 获取目标目录下的相关文件
function getFileList ({ path = process.cwd(), deep = Infinity } = {}) {
  const files = fg.sync('**/*', {
    cwd: path,
    onlyFiles: false,
    dot: true,
    deep: deep,
    ignore: ['**/.git/**']
  })
  return files
}

// Promise 包装的 git 仓库下载
function gitPromiseDownload (
  repository,
  destination,
  options,
  callback = () => {}
) {
  return new Promise((resolve, reject) => {
    download(repository, destination, options, (err) => {
      callback(err)
      resolve(true)
    })
  })
}

// Promise 包装的 rimraf 删除
function rimrafPromise (path, callback = () => {}) {
  return new Promise((resolve, reject) => {
    rimraf(path, function () {
      callback()
      resolve(true)
    })
  })
}

program.command('init').action(async () => {
  // 检测当前目录是否为空（除了 .git），进行提示
  if (getFileList({ deep: 1 }).length !== 0) {
    const { isContinue } = await inquirer.prompt([
      {
        name: 'isContinue',
        message: '当前目录非空，继续操作可能会覆盖当前目录文件，是否继续？',
        type: 'list',
        choices: ['Yes', 'No']
      }
    ])
    isContinue === 'No' && process.exit(1)
  }

  const tempDirName = '_temp'
  const tempDirPath = join(process.cwd(), tempDirName) // 临时文件夹的路径
  // 检查临时文件夹是否已存在
  if (existsSync(tempDirName)) {
    console.log(
      symbols.error,
      chalk.red(
        `当前目录已存在 ${chalk.yellow(tempDirName)} 文件夹，请删除后重试！"`
      )
    )
    process.exit(1)
  }

  const cloneSpinner = ora('模板拉取中...')
  cloneSpinner.start()

  const downloadPath = 'direct:https://gitee.com/poozhu/react-app-template.git'
  await gitPromiseDownload(
    downloadPath,
    tempDirName,
    { clone: true },
    (err) => {
      if (err) {
        cloneSpinner.fail()
        console.log(symbols.error, chalk.red(err))
        console.log(
          symbols.error,
          chalk.red('模板拉取失败，请检查网络连接情况后重试！')
        )
        process.exit(1)
      }
      cloneSpinner.succeed('模板拉取完毕')

      // 采取了先拉代码到临时文件夹，再从临时文件夹拷贝到当前目录的方式。用以解决当前目录非空时 git 拉取会失败的场景

      const files = getFileList({ path: tempDirPath })
      files.forEach((file) => {
        const resourceFile = join(tempDirPath, file)
        if (statSync(resourceFile).isDirectory()) return

        console.log(`${chalk.green('Copy: ')} ${file}`)
        const targetFile = join(process.cwd(), file)
        mkdirp.sync(dirname(targetFile))
        copyFileSync(resourceFile, targetFile)
      })
    }
  )

  // 删除临时文件夹
  await rimrafPromise(tempDirPath)

  console.log(symbols.success, chalk.green('✨ 创建成功！'))
})

program.parse(process.argv)
