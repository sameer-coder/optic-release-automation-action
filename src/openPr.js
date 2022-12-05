'use strict'

const fs = require('fs')
const path = require('path')
const _template = require('lodash.template')
const semver = require('semver')
const core = require('@actions/core')

const { PR_TITLE_PREFIX } = require('./const')
const { runSpawn } = require('./utils/runSpawn')
const { callApi } = require('./utils/callApi')
const transformCommitMessage = require('./utils/commitMessage')
const { logInfo } = require('./log')
const { attach } = require('./utils/artifact')

const tpl = fs.readFileSync(path.join(__dirname, 'pr.tpl'), 'utf8')

const getPRBody = (
  template,
  { newVersion, draftRelease, inputs, author, artifact }
) => {
  const tagsToBeUpdated = []
  const { major, minor } = semver.parse(newVersion)

  if (major !== 0) tagsToBeUpdated.push(`v${major}`)
  if (minor !== 0) tagsToBeUpdated.push(`v${major}.${minor}`)

  // Should strictly contain only non-sensitive data
  const releaseMeta = {
    id: draftRelease.id,
    version: newVersion,
    npmTag: inputs['npm-tag'],
    opticUrl: inputs['optic-url'],
  }

  return template({
    releaseMeta,
    draftRelease,
    tagsToUpdate: tagsToBeUpdated.join(', '),
    npmPublish: !!inputs['npm-token'],
    artifact,
    syncTags: /true/i.test(inputs['sync-semver-tags']),
    author,
  })
}

const addArtifact = async (inputs, releaseId) => {
  const artifactPath = inputs['artifact-path']
  const token = inputs['github-token']

  const artifact = await attach(artifactPath, releaseId, token)

  return artifact
}

const createDraftRelease = async (inputs, newVersion) => {
  try {
    const run = runSpawn()
    const releaseCommitHash = await run('git', ['rev-parse', 'HEAD'])

    logInfo(`Creating draft release from commit: ${releaseCommitHash}`)

    const { data: draftRelease } = await callApi(
      {
        method: 'POST',
        endpoint: 'release',
        body: {
          version: newVersion,
          target: releaseCommitHash,
        },
      },
      inputs
    )

    logInfo(`Draft release created successfully`)

    return draftRelease
  } catch (err) {
    throw new Error(`Unable to create draft release: ${err.message}`)
  }
}

module.exports = async function ({ context, inputs, packageVersion }) {
  logInfo('** Starting Opening Release PR **')
  const run = runSpawn()

  if (!packageVersion) {
    throw new Error('packageVersion is missing!')
  }

  const newVersion = `${inputs['version-prefix']}${packageVersion}`

  const branchName = `release/${newVersion}`

  const messageTemplate = inputs['commit-message']
  await run('git', ['checkout', '-b', branchName])
  await run('git', ['add', '-A'])
  await run('git', [
    'commit',
    '-m',
    `"${transformCommitMessage(messageTemplate, newVersion)}"`,
  ])

  await run('git', ['push', 'origin', branchName])

  const draftRelease = await createDraftRelease(inputs, newVersion)

  logInfo(`New versionnn ${newVersion}`)

  const artifact =
    inputs['artifact-path'] && (await addArtifact(inputs, draftRelease.id))
  if (artifact) {
    logInfo('Artifact attached!')
  }
logInfo('before getPRBody!')
  const prBody = getPRBody(_template(tpl), {
    newVersion,
    draftRelease,
    inputs,
    author: context.actor,
    artifact,
  })
  logInfo(prBody)
  try {
    logInfo('** Starting await callApi**')
    const response = await callApi(
      {
        method: 'POST',
        endpoint: 'pr',
        body: {
          head: `refs/heads/${branchName}`,
          base: context.payload.ref,
          title: `${PR_TITLE_PREFIX} ${branchName}`,
          body: prBody,
        },
      },
      inputs
    )

    // logInfo(JSON.stringify(response))
    logInfo(JSON.stringify(response?.statusCode || 'status'))
    logInfo(JSON.stringify(response?.status || 'status'))
    logInfo(JSON.stringify(response?.error || 'error'))
    logInfo(JSON.stringify(response?.message || 'message'))
  } catch (err) {
    let message = `Unable to create the pull request ${err.message}`
    logInfo(message)
    try {
      await run('git', ['push', 'origin', '--delete', branchName])
    } catch (error) {
      message += `\n Unable to delete branch ${branchName}:  ${error.message}`
    }
    core.setFailed(message)
  }

  logInfo('** Finished! **')
}
