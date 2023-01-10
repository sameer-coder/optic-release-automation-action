'use strict'

const github = require('@actions/github')
const { logInfo, logWarning } = require('../log')

const opticReleaseNotesMatchText = '* [OPTIC-RELEASE-AUTOMATION]'

async function fetchLatestRelease(token) {
  try {
    logInfo('Fetching the latest release')

    const { owner, repo } = github.context.repo
    const octokit = github.getOctokit(token)
    const { data: latestRelease } = await octokit.rest.repos.getLatestRelease({
      owner,
      repo,
    })

    logInfo(
      `Latest release fetched successfully with tag: ${latestRelease.tag_name}`
    )

    return latestRelease
  } catch (err) {
    if (err.message === 'Not Found') {
      logInfo(`No previous releases found`)
      return
    }

    throw new Error(
      `An error occurred while fetching the latest release: ${err.message}`
    )
  }
}

function excludeUnwantedNotes(releaseNotes) {
  try {
    const splitLines = releaseNotes.split('\n')
    return splitLines
      .filter(line => !line.includes(opticReleaseNotesMatchText))
      .join('\n')
  } catch (error) {
    logWarning(
      `Error excluding unwanted release notes. Error - ${error.message}`
    )
  }
  return releaseNotes
}

async function generateReleaseNotes(token, newVersion, baseVersion) {
  try {
    logInfo(`Generating release notes: [${baseVersion} -> ${newVersion}]`)

    const { owner, repo } = github.context.repo
    const octokit = github.getOctokit(token)

    const { data: releaseNotes } =
      await octokit.rest.repos.generateReleaseNotes({
        owner,
        repo,
        tag_name: newVersion,
        ...(baseVersion && { previous_tag_name: baseVersion }),
      })

    logInfo(`Release notes generated: [${baseVersion} -> ${newVersion}]`)

    return releaseNotes
  } catch (err) {
    throw new Error(
      `An error occurred while generating the release notes: ${err.message}`
    )
  }
}

module.exports = {
  fetchLatestRelease,
  generateReleaseNotes,
}

// const releasents = {
//   name: 'v1.2.4',
//   body:
//     "## What's Changed\n" +
//     '* chore(deps-dev): bump esbuild from 0.15.6 to 0.15.7 by @dependabot in https://github.com/nearform/github-board-slack-notifications/pull/127\n' +
//     '* chore(deps): bump fastify-cli from 5.4.0 to 5.4.1 by @dependabot in https://github.com/nearform/github-board-slack-notifications/pull/128\n' +
//     '* chore(deps): bump @fastify/aws-lambda from 3.1.1 to 3.1.3 by @dependabot in https://github.com/nearform/github-board-slack-notifications/pull/129\n' +
//     '* chore(deps): bump constructs from 10.1.94 to 10.1.95 by @dependabot in https://github.com/nearform/github-board-slack-notifications/pull/130\n' +
//     '* chore(deps-dev): bump aws-cdk from 2.40.0 to 2.41.0 by @dependabot in https://github.com/nearform/github-board-slack-notifications/pull/131\n' +
//     '* chore(deps): bump aws-cdk-lib from 2.40.0 to 2.41.0 by @dependabot in https://github.com/nearform/github-board-slack-notifications/pull/132\n' +
//     '* chore(deps): bump constructs from 10.1.95 to 10.1.96 by @dependabot in https://github.com/nearform/github-board-slack-notifications/pull/133\n' +
//     '* chore(deps): bump constructs from 10.1.96 to 10.1.97 by @dependabot in https://github.com/nearform/github-board-slack-notifications/pull/134\n' +
//     '* remove optional github token by @marco-ippolito in https://github.com/nearform/github-board-slack-notifications/pull/135\n' +
//     '* chore(deps): bump constructs from 10.1.97 to 10.1.100 by @dependabot in https://github.com/nearform/github-board-slack-notifications/pull/136\n' +
//     '* chore(deps-dev): bump eslint from 8.23.0 to 8.23.1 by @dependabot in https://github.com/nearform/github-board-slack-notifications/pull/137\n' +
//     '* [OPTIC-RELEASE-AUTOMATION] release/v1.2.4 by @optic-release-automation in https://github.com/nearform/github-board-slack-notifications/pull/139\n' +
//     '\n' +
//     '\n' +
//     '**Full Changelog**: https://github.com/nearform/github-board-slack-notifications/compare/v1.2.3...v1.2.4',
// }

// console.log(`starting`)
// console.log(releasents.body)
// console.log(excludeUnwantedNotes(releasents.body))
