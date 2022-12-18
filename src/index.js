'use strict'

// const openPr = require('./openPr')
const release = require('./release')
const { getAutoBumpedVersion } = require('./utils/bump')
const { runSpawn } = require('./utils/runSpawn')
const { logError, logInfo } = require('./log')
const conventionalRecommendedBump = require(`conventional-recommended-bump`)

async function runAction({ github, context, inputs, packageVersion }) {
  if (context.eventName === 'workflow_dispatch') {
    logInfo(`packageVersion = ${packageVersion}`)
    return
  }

  if (context.eventName === 'pull_request') {
    return release({ github, context, inputs })
  }

  logError('Unsupported event')
}

async function getBumpedVersionNumber({ inputs }) {
  const newVersion =
    inputs.semver === 'auto' ? await conventionalRecommended() : inputs.semver

  logInfo(`=-LOG-= ---> newVersion ${newVersion}`)

  const run = runSpawn()
  await run('npm', ['version', '--no-git-tag-version', newVersion])
  return await run('npm', ['pkg', 'get', 'version'])
}

async function conventionalRecommended() {
  await conventionalRecommendedBump(
    {
      preset: `angular`,
    },
    (error, recommendation) => {
      if (error) {
        logError(error.message)
        throw error
      }
      logInfo(recommendation.releaseType) // 'major'
      return recommendation.releaseType
    }
  )
}

module.exports.runAction = runAction
module.exports.getBumpedVersionNumber = getBumpedVersionNumber
module.exports.getAutoBumpedVersion = getAutoBumpedVersion
