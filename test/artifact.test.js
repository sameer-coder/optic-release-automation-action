'use strict'

const tap = require('tap')
const { ZIP_EXTENSION } = require('../src/const')

const DEFAULT_INPUT_DATA = {
  artifactPath: 'dist',
  releaseId: '1',
  token: 'token',
}

const setup = ({ throwsError }) => {
  const attachArtifactModule = tap.mock('../src/utils/artifact.js', {
    '../src/utils/archiver.js': {
      archiveItem: async () => null,
    },
    'fs/promises': {
      stat: async () => 100,
      lstat: async () => ({ isDirectory: () => true }),
      readFile: async () => Buffer.from('hello world'),
    },
    '@actions/github': {
      context: {
        repo: {
          repo: 'repo',
          owner: 'owner',
        },
      },
      getOctokit: () => ({
        rest: {
          repos: {
            uploadReleaseAsset: async () => {
              if (throwsError) {
                throw new Error()
              }
              return {
                status: 201,
                data: { state: 'uploaded' },
              }
            },
          },
        },
      }),
    },
  })

  return { attachArtifactModule }
}

tap.test(
  'attach artifact does not throw errors with proper inputs',
  async t => {
    const { attachArtifactModule } = setup({ throwsError: false })

    const { artifactPath, releaseId, token } = DEFAULT_INPUT_DATA

    t.resolves(attachArtifactModule.attach(artifactPath, releaseId, token))
  }
)

tap.test(
  'attach artifact does not throw errors with path ending with .zip',
  async t => {
    const { attachArtifactModule } = setup({ throwsError: false })

    const { artifactPath, releaseId, token } = DEFAULT_INPUT_DATA

    t.resolves(
      attachArtifactModule.attach(
        artifactPath + ZIP_EXTENSION,
        releaseId,
        token
      )
    )
  }
)

tap.test(
  'attach artifact throws an error if build folder not found',
  async t => {
    const artifactModule = tap.mock('../src/utils/artifact.js', {
      '../src/utils/archiver.js': {
        archiveItem: async () => {
          throw new Error('file not found')
        },
      },
    })

    const { artifactPath, releaseId, token } = DEFAULT_INPUT_DATA

    t.rejects(artifactModule.attach(artifactPath, releaseId, token))
  }
)

tap.test(
  'attach artifact throws an error if an error occurres during the asset upload',
  async t => {
    const { attachArtifactModule } = setup({ throwsError: true })

    const { artifactPath, releaseId, token } = DEFAULT_INPUT_DATA

    t.rejects(attachArtifactModule.attach(artifactPath, releaseId, token))
  }
)

tap.test(
  'attach artifact throws an error if the upload asset state is not uploaded',
  async t => {
    const artifactModule = tap.mock('../src/utils/artifact.js', {
      '../src/utils/archiver.js': {
        archiveItem: async () => null,
      },
      'fs/promises': {
        stat: async () => 100,
        lstat: async () => ({ isDirectory: () => true }),
        readFile: async () => Buffer.from('hello world'),
      },
      '@actions/github': {
        context: {
          repo: {
            repo: 'repo',
            owner: 'owner',
          },
        },
        getOctokit: () => ({
          rest: {
            repos: {
              uploadReleaseAsset: async () => ({
                status: 201,
                data: { state: 'not_uploaded' },
              }),
            },
          },
        }),
      },
    })

    const { artifactPath, releaseId, token } = DEFAULT_INPUT_DATA

    t.rejects(artifactModule.attach(artifactPath, releaseId, token))
  }
)
