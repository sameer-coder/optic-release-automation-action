'use strict'

const semver = require('semver')
const conventionalCommitsParser = require('conventional-commits-parser')

async function getAutoBumpedVersion({ github, context }) {
  const { owner, repo } = context.repo

  const {
    latestReleaseCommitSha,
    latestReleaseTagName,
    latestReleaseCommitDate,
  } = await getLatestRelease({ github, owner, repo })

  if (
    !latestReleaseCommitSha ||
    !latestReleaseTagName ||
    !latestReleaseCommitDate
  ) {
    throw new Error(`Couldn't find latest release`)
  }

  const allCommits = await getCommitMessagesSinceLatestRelease({
    github,
    owner,
    repo,
    commitDate: latestReleaseCommitDate,
  })

  if (!allCommits.length) {
    throw new Error(`No commits found since last release`)
  }

  const bumpedVersion = getVersionFromCommits(latestReleaseTagName, allCommits)

  if (!semver.valid(bumpedVersion)) {
    throw new Error(`Invalid bumped version ${bumpedVersion}`)
  }
  return bumpedVersion
}

function getVersionFromCommits(currentVersion, commits = []) {
  let { major, minor, patch } = semver.parse(currentVersion)

  if (
    !Number.isInteger(major) ||
    !Number.isInteger(minor) ||
    !Number.isInteger(patch)
  ) {
    throw new Error('Invalid major/minor/patch version found')
  }

  let isBreaking = false
  let isMinor = false

  const commitsb = [
    'feat(ng-list): Allow custom separator\n' +
      'bla bla bla\n\n' +
      'Closes #123\nCloses #25\nFixes #33\n',

    'feat(scope): broadcast $destroy event on scope destruction\n' +
      'bla bla bla\n\n' +
      'BREAKING CHANGE: some breaking change\n',

    'fix(zzz): Very cool commit\n' +
      'bla bla bla\n\n' +
      'Closes #2, #3. Resolves #4. Fixes #5. Fixes #6.\n' +
      'What not ?\n',

    'chore(scope with spaces): some chore\n' +
      'bla bla bla\n\n' +
      'BREAKING CHANGE: some other breaking change\n',

    'Revert "throw an error if a callback is passed to animate methods"\n\n' +
      'This reverts commit 9bb4d6ccbe80b7704c6b7f53317ca8146bc103ca.\n\n' +
      '-hash-\n' +
      'd7a40a29214f37d469e57d730dfd042b639d4d1f',
  ]

  for (const commit of commitsb) {
    let cc = 'BREAKING CHANGE: some other breaking change'
    const type = conventionalCommitsParser.sync(commit)
    console.log(`=-LOG-= ---> type ${JSON.stringify(type)} ${cc}`)
    if (!type) {
      console.log(`Failed to parse ${type} ${commit}`)
      continue
    }

    if (type === 'major' && major === '0') {
      // According to semver, major version zero (0.y.z) is for initial
      // development. Anything MAY change at any time.
      // Breaking changes MUST NOT automatically bump the major version
      // from 0.x to 1.x.
      isMinor = true
      break
    } else if (type === 'major') {
      isBreaking = true
      break
    } else if (type === 'minor') {
      isMinor = true
    }
  }

  if (isBreaking) {
    return `${++major}.0.0`
  } else if (isMinor) {
    return `${major}.${++minor}.0`
  } else {
    return `${major}.${minor}.${++patch}`
  }
}

async function getLatestRelease({ github, owner, repo }) {
  const data = await github.graphql(
    `
    query getLatestTagCommit($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        latestRelease{
          tagName
          tagCommit {
            oid
            committedDate
          }
        }
      }
    }
    `,
    {
      owner,
      repo,
    }
  )

  const latestReleaseCommitSha = data?.repository?.latestRelease?.tagCommit?.oid
  const latestReleaseTagName = data?.repository?.latestRelease?.tagName
  const latestReleaseCommitDate =
    data?.repository?.latestRelease?.tagCommit?.committedDate

  return {
    latestReleaseCommitSha,
    latestReleaseTagName,
    latestReleaseCommitDate,
  }
}

async function getCommitMessagesSinceLatestRelease({
  github,
  owner,
  repo,
  commitDate,
}) {
  const parsedCommitDate = new Date(commitDate)
  parsedCommitDate.setSeconds(parsedCommitDate.getSeconds() + 1)

  const data = await github.graphql(
    `
      query getCommitsSinceLastRelease($owner: String!, $repo: String!, $since: GitTimestamp!) {
        repository(owner: $owner, name: $repo) {
          defaultBranchRef {
            target {
              ... on Commit {
                history(first: 100, since: $since) {
                  nodes {
                    message
                  }
                }
              }
            }
          }
        }
      }
    `,
    {
      owner,
      repo,
      since: parsedCommitDate,
    }
  )

  const commitsList =
    data?.repository?.defaultBranchRef?.target?.history?.nodes || []
  return commitsList.map(c => c.message)
}

module.exports = {
  getAutoBumpedVersion,
}
