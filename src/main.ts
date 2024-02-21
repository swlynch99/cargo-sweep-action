import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import { exec } from '@actions/exec'
import { HttpClient } from '@actions/http-client'
import { WritableStreamBuffer } from 'stream-buffers'
import * as fs from 'fs/promises'
import * as path from 'path';
import * as os from 'os';

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

  const exitCode = await exec('rustc', ['--version', '--verbose'], {
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
  const triple = lines[0].split(':', 2)[1].trim()

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

// Convert a generic target to a musl one.
function getMuslTarget(target: string): string {
  const components = target.split('-');
  components[components.length - 1] = 'musl';
  return components.join('-');
}

async function downloadCargoSweep(version: string, target: string): Promise<string | undefined> {
  const baseUrl = 'https://github.com/cargo-bins/cargo-quickinstall/releases/download'
  const url = `${baseUrl}/cargo-sweep-${version}/cargo-sweep-${version}-${target}.tar.gz`

  core.debug(`Attempting download from ${url}`)

  try {
    const path = await tc.downloadTool(url)
    const extracted = await tc.extractTar(path)
    return await tc.cacheDir(extracted, 'cargo-sweep', version, target)
  } catch (e) {
    // return nothing
  }
}

async function installCargoSweep(): Promise<string> {
  const version = await getLatestVersion();
  const target = await getTargetFromRustc();
  let cached: string | undefined;

  cached = tc.find('cargo-sweep', version, target);
  if (cached)
    return cached;

  cached = await downloadCargoSweep(version, target);
  if (cached)
    return cached;

  const muslTarget = getMuslTarget(target)
  if (muslTarget !== target) {
    cached = await downloadCargoSweep(version, muslTarget)
    if (cached)
      return cached;
  }

  core.startGroup("cargo install cargo-watch")
  const tempdir = await fs.mkdtemp(path.join(
    process.env['RUNNER_TEMP'] || os.tmpdir(),
    'cargo-sweep-action'
  ))
  await exec('cargo', ['install', 'cargo-sweep', '--root', tempdir])
  core.endGroup()

  return await tc.cacheDir(path.join(tempdir, 'bin'), 'cargo-sweep', version)
}

async function run(): Promise<void> {
  const cached = await installCargoSweep();

  core.debug(`cargo-sweep downloaded to ${cached}`)
  core.addPath(cached)

  await exec('cargo', ['sweep', '-s'])
}

run()
