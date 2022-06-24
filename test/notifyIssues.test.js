'use strict'

const proxyquire = require('proxyquire')
const sinon = require('sinon')
const tap = require('tap')

const pullsGetStub = sinon.stub()
const createCommentStub = sinon.stub()
const noDataGraphqlStub = sinon.stub().resolves({
  repository: {
    pullRequest: {
      closingIssuesReferences: {},
    },
  },
})

const DEFAULT_GITHUB_CLIENT = {
  rest: {
    issues: { createComment: createCommentStub },
    pulls: { get: pullsGetStub },
  },
  graphql: noDataGraphqlStub,
}

function setup() {
  const readFileSyncStub = sinon
    .stub()
    .withArgs('./package.json', 'utf8')
    .returns('{ "name": "packageName", "version": "1.0.0"}')

  const { notifyIssues } = proxyquire('../src/utils/notifyIssues', {
    fs: { readFileSync: readFileSyncStub },
  })

  return { notifyIssues }
}

tap.afterEach(() => {
  sinon.restore()
})

tap.test('Should not call createComment if no linked issues', async () => {
  const { notifyIssues } = setup()

  const releaseNotes = `
    ## What's Changed\n +
    * chore 15 by @people in https://github.com/owner/repo/pull/13\n
    * chore 18 by @people in https://github.com/owner/repo/pull/15\n
    * chore 19 by @people in https://github.com/owner/repo/pull/16\n
    \n
    \n
    **Full Changelog**: https://github.com/owner/repo/compare/v1.0.20...v1.1.0
  `

  const release = { body: releaseNotes, html_url: 'some_url' }

  await notifyIssues(DEFAULT_GITHUB_CLIENT, 'owner', 'repo', release)

  sinon.assert.notCalled(createCommentStub)
})

tap.test(
  'Should call createComment with correct arguments for linked issues',
  async () => {
    const { notifyIssues } = setup()

    const releaseNotes = `
      ## What's Changed\n +
      * chore 15 by @people in https://github.com/owner/repo/pull/13\n
      \n
      \n
      **Full Changelog**: https://github.com/owner/repo/compare/v1.0.20...v1.1.0
    `

    const release = { body: releaseNotes, html_url: 'some_url' }

    const graphqlStub = sinon.stub().resolves({
      repository: {
        pullRequest: {
          closingIssuesReferences: {
            nodes: [{ number: '10' }, { number: '15' }],
          },
        },
      },
    })

    await notifyIssues(
      { ...DEFAULT_GITHUB_CLIENT, graphql: graphqlStub },
      'owner',
      'repo',
      release
    )

    const expectedCommentBody = `🎉 This issue has been resolved in version 1.0.0 🎉 \n\n
  The release is available on: \n * [npm package](https://www.npmjs.com/package/packageName/v/1.0.0) \n
  * [GitHub release](some_url) \n\n Your **[optic](https://github.com/nearform/optic)** bot 📦🚀`

    sinon.assert.calledWith(createCommentStub, {
      owner: 'owner',
      repo: 'repo',
      issue_number: '10',
      body: expectedCommentBody,
    })

    sinon.assert.calledWith(createCommentStub, {
      owner: 'owner',
      repo: 'repo',
      issue_number: '15',
      body: expectedCommentBody,
    })
  }
)