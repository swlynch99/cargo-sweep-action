import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as exec from '@actions/exec'
import { HttpClient } from '@actions/http-client'
import { WritableStreamBuffer } from 'stream-buffers'

const client = new HttpClient('cargo-sweep-action')

async function getLatestVersion(): Promise<string> {
  const url = 'https://crates.io/api/v1/crates/cargo-sweep'

  core.debug(`querying crates.io API for latest version (at ${url})`)
  const response = await client.get(url)

  core.debug(`got status code ${response.message.statusCode}`)
  if (response.message.statusCode !== 200) {
    core.debug(await response.readBody())
    throw new Error('unable to fetch the latest version of cargo-sweep')
  }

  const json = JSON.parse(await response.readBody())
  return json.crate.max_stable_version
}

async function getTargetFromRustc(): Promise<string> {
  const output = new WritableStreamBuffer()

  const exitCode = await exec.exec('rustc', ['--version', '--verbose'], {
    outStream: output,
    ignoreReturnCode: true
  })

  if (exitCode !== 0) {
    throw new Error('rustc -vV exited with an error code')
  }

  const contents = output.getContentsAsString('utf8')
  if (!contents) {
    throw new Error('rustc -vV emitted invalid UTF-8')
  }

  const lines = contents.split('\n').filter(line => line.startsWith('host:'))
  if (lines.length === 0) {
    throw new Error('unable to determine current target triple from rustc -vV')
  }

  core.debug(`rustc emitted target info: ${lines[0]}`)
  const [_, triple] = lines[0].split(':', 2)

  // The following is basically copied from cargo-quickinstall.
  //
  // Target triplets have the form of `arch-vendor-system`. When building for
  // Linux (i.e. the system part is `linux-something`) we want to replace the
  // vendor with `unknown` so that we download the correct binary.

  const components = triple.split('-', 4)
  if (components[2] === 'linux') {
    components[1] = 'unknown'
  }

  return components.join('-')
}

export async function installLatestVersion(): Promise<void> {
  const baseUrl =
    'https://github.com/cargo-bins/cargo-quickinstall/releases/download'
  const version = await getLatestVersion()
  const target = await getTargetFromRustc()
  const url = `${baseUrl}/cargo-sweep-${version}/cargo-sweep-${version}-${target}.tar.gz`

  let cached = tc.find('cargo-sweep', version, target)
  if (!cached) {
    core.debug(`downloading from ${url}`)
    const path = await tc.downloadTool(url)
    const extracted = await tc.extractTar(path)
    cached = await tc.cacheDir(extracted, 'cargo-sweep', version, target)
  }

  core.debug(`cargo-sweep downloaded to ${cached}`)

  core.addPath(cached)
}

async function run(): Promise<void> {
  await installLatestVersion()
  await exec.exec('cargo', ['sweep', '-s'])
}

run()
