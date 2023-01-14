//check if base branch
// check if expected sha is latest
// add comment and change body

// do not create another pr if one exists
// do not allow to release if pending commits

'use strict'

const { PR_TITLE_PREFIX, BOT_ACCOUNT } = require('./const')
const { logInfo } = require('./log')
const github = require('@actions/github')

const getOpticPr = async ({ octokit, repo, owner }) => {
  try {
    const iterator = octokit.paginate.iterator(octokit.rest.pulls.list, {
      owner,
      repo,
      state: 'open',
      sort: 'created',
      direction: 'desc',
      per_page: 100,
    })

    logInfo(`ierator is ${iterator}`)

    for await (const { data } of iterator) {
      logInfo(`data is ${JSON.stringify(data)}`)
      for (const pr of data) {
        const { title = '', body = '', user = {} } = pr
        logInfo(`=-LOG-= ---> pr item - JSON.stringify(pr)`)

        // Skip other PRs
        if (
          !title.includes(PR_TITLE_PREFIX) ||
          !body ||
          user.type !== BOT_ACCOUNT
        ) {
          logInfo(`skipping PR ${title}`)
          continue
        }
        return pr
      }
    }
  } catch (err) {
    throw new Error(
      `An error occurred while getting existing optic PR: ${err.message}`
    )
  }
}

module.exports = async function ({ context, inputs }) {
  logInfo('** Starting to update Release PR **')

  const token = inputs['github-token']
  const octokit = github.getOctokit(token)

  const owner = context.repo.owner
  const repo = context.repo.repo

  const splitRef = context.ref.split('/')

  if (!splitRef.length === 3) {
    throw new Error(`Couldn't get workflow base branch`)
  }

  const workflowBranch = splitRef[2]
  logInfo(`=-LOG-= ---> workflowBranch ${workflowBranch}`)

  // Get optic PR
  const opticPr = await getOpticPr({ octokit, repo, owner })
  logInfo(`=-LOG-= ---> opticPr - ${opticPr}`)

  // check if branch is same
  if (workflowBranch !== opticPr.base.ref) {
    throw new Error(`Skipping release bump. Base branch of PR is different`) // todo: Improve message
  }

  logInfo('Updating PR.....')
  // update PR
  await octokit.rest.pulls.updateBranch({
    owner,
    repo,
    pull_number: opticPr.number,
  })

  // octokit.rest.pulls.update({
  //   owner,
  //   repo,
  //   pull_number: opticPr.number,
  // })

  logInfo('** Finished! **')
}
