import * as core from '@actions/core'
import * as exec from '@actions/exec'

async function sweep(): Promise<void> {
  core.startGroup('run cargo-sweep')
  exec.exec('cargo', ['sweep', '-f'])
  core.endGroup()
}

sweep()
