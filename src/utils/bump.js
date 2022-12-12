'use strict'
const { logInfo } = require('../log')

async function getBumpedVersion({ github, context, versionPrefix }) {
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

  const allCommits = await getCommitsSinceLatestRelease({
    github,
    owner,
    repo,
    commitDate: latestReleaseCommitDate,
  })

  if (!allCommits.length) {
    throw new Error(`Couldn't get list of commits since last release`)
  }

  logInfo('allCommits')
  console.log(JSON.stringify(allCommits))

  logInfo(`latestReleaseTagName, ${latestReleaseTagName}`)
  logInfo(`versionPrefix, ${versionPrefix}`)
  logInfo(`boolean, ${latestReleaseTagName.includes(versionPrefix)}`)

  const isTagVersionPrefixed = latestReleaseTagName.includes(versionPrefix)
  logInfo(`isTagVersionPrefixed, ${isTagVersionPrefixed}`)

  const currentVersion = isTagVersionPrefixed
    ? latestReleaseTagName.replace(versionPrefix, '')
    : latestReleaseTagName.replace(versionPrefix, 'v.') // default prefix

  logInfo(`currentVersion, ${currentVersion}`)

  if (!currentVersion) {
    throw new Error(`Couldn't find latest version`)
  }

  return getVerionFromCommits(currentVersion, allCommits)
}

function getVerionFromCommits(currentVersion, commits = []) {
  // Define a regular expression to match Conventional Commits messages
  const commitRegex = /^(feat|fix|BREAKING CHANGE)(\(.+\))?:\s(.+)$/

  // Define a mapping of commit types to version bump types
  var versionBumpMap = {
    'BREAKING CHANGE': 'major',
    feat: 'minor',
    fix: 'patch',
  }

  let [major, minor, patch] = currentVersion.split('.')
  let isBreaking = false
  let isMinor = false

  for (const commit of commits) {
    const match = commitRegex.exec(commit)
    if (!match) continue

    const type = match[1]

    // Determine the version bump type based on the commit type
    const bumpType = versionBumpMap[type]
    if (!bumpType) continue

    if (bumpType === 'major') {
      isBreaking = true
      break
    } else if (bumpType === 'minor') {
      isMinor = true
    }
  }

  if (isBreaking) {
    return `${major++}.0.0`
  } else if (isMinor) {
    return `${major}.${minor++}.0`
  } else {
    return `${major}.${minor}.${patch++}`
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

  logInfo(`response from get latest release query ${JSON.stringify(data)}`)

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

async function getCommitsSinceLatestRelease({
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

  logInfo(`response from get commits query ${JSON.stringify(data)}`)

  const commitsList =
    data?.repository?.defaultBranchRef?.target?.history?.nodes || []
  return commitsList.map(c => c.message)
}

exports.getBumpedVersion = getBumpedVersion
