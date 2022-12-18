'use strict'

const openPr = require('./openPr')
const release = require('./release')
const { runSpawn } = require('./utils/runSpawn')
const { logError } = require('./log')
const core = require('@actions/core')
const util = require('util')
const conventionalRecommendedBump = require('conventional-recommended-bump')
const conventionalRecommendedBumpAsync = util.promisify(
  conventionalRecommendedBump
)

async function runAction({ github, context, inputs, packageVersion }) {
  if (context.eventName === 'workflow_dispatch') {
    console.log(`packageVersion is ${packageVersion}`)
    // return openPr({ context, inputs, packageVersion })
  }

  if (context.eventName === 'pull_request') {
    return release({ github, context, inputs })
  }

  logError('Unsupported event')
}

async function getBumpedVersionNumber({ github, context, inputs }) {
  const run = runSpawn()

  console.log('listing-', await run('npm', ['list', '--depth=0']))
  const newVersion =
    inputs.semver === 'auto'
      ? await getAutoBumpedVersion({ github, context })
      : inputs.semver

  await run('npm', ['version', '--no-git-tag-version', newVersion])
  return await run('npm', ['pkg', 'get', 'version'])
}

async function getAutoBumpedVersion() {
  try {
    const { releaseType } = await conventionalRecommendedBumpAsync({
      preset: 'conventionalcommits',
    })
    return releaseType
  } catch (error) {
    core.setFailed(error.message)
    throw error
  }
}

module.exports = {
  runAction,
  getBumpedVersionNumber,
}

getAutoBumpedVersion().catch(console.log)
