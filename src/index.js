'use strict'

const openPr = require('./openPr')
const updatePR = require('./updatePr')
const release = require('./release')
const { logError, logInfo } = require('./log')

module.exports = async function ({ github, context, inputs, packageVersion }) {
  logInfo(`context.eventName = ${context.eventName}`)
  if (context.eventName === 'workflow_dispatch') {
    return openPr({ context, inputs, packageVersion })
  }

  if (context.eventName === 'pull_request') {
    return release({ github, context, inputs })
  }

  if (context.eventName === 'push') {
    return updatePR({ context, inputs })
  }

  logError('Unsupported event')
}
