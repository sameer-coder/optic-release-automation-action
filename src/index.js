'use strict'

// const openPr = require('./openPr')
const release = require('./release')
const { logError, logInfo } = require('./log')
const { getBumpedVersion } = require('./utils/bump')

module.exports = async function ({ github, context, inputs, packageVersion }) {
  if (context.eventName === 'workflow_dispatch') {
    logInfo(`packageVersion = ${packageVersion}`)
    return
    // return openPr({ github, context, inputs, packageVersion })
  }

  if (context.eventName === 'pull_request') {
    return release({ github, context, inputs })
  }

  logError('Unsupported event')
}

module.exports.getBumpedVersion = getBumpedVersion
