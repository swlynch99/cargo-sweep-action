import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as exec from '@actions/exec'
import * as stream from 'stream'
import { HttpClient } from '@actions/http-client'

const client = new HttpClient('cargo-sweep-action')

class StringStream extends stream.Writable {
  constructor() {
    super()
    stream.Writable.call(this)
  }

  private contents = ''

  _write(
    data: string | Buffer | Uint8Array,
    encoding: string,
    next: Function
  ): void {
    this.contents += data
    next()
  }

  getContents(): string {
    return this.contents
  }
}

async function getLatestVersion() {
  const response = await client.get('https://crates.io/api/v1/crates/')

  if (response.message.statusCode != 200) {
    core.debug(await response.readBody())
    throw new Error('unable to fetch the latest version of cargo-sweep')
  }

  const json = JSON.parse(await response.readBody())
  return json.crate.max_stable_version
}

async function getTargetFromRustc(): Promise<string> {
  let output = new StringStream()

  const exitCode = await exec.exec('rustc', ['--version', '--verbose'], {
    outStream: output,
    ignoreReturnCode: true
  })

  if (exitCode !== 0) {
    throw new Error('rustc -vV exited with an error code')
  }

  const lines = output
    .getContents()
    .split('\n')
    .filter(line => line.startsWith('host:'))
  if (lines.length == 0) {
    throw new Error('unable to determine current target triple from rustc -vV')
  }

  const triple = lines[0].split(':', 1)[1].trim()

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

export async function installLatestVersion() {
  const baseUrl =
    'https://github.com/cargo-bins/cargo-quickinstall/releases/download'
  const version = await getLatestVersion()
  const target = await getTargetFromRustc()

  let cached = tc.find('cargo-sweep', version, target)
  if (!cached) {
    const path = await tc.downloadTool(
      `${baseUrl}/cargo-sweep-${version}/cargo-sweep-${version}-${target}.tar.gz`
    )
    const extracted = await tc.extractTar(path)
    cached = await tc.cacheDir(extracted, 'cargo-sweep', version, target)
  }

  core.addPath(cached)
}

(async () => {
    try {
        await installLatestVersion();
        await exec.exec('cargo', ['sweep', '-s']);
    } catch (e) {
        core.setFailed(e as any)
    }
})
