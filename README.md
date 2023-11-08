# Create a GitHub Action Using TypeScript

[![GitHub Super-Linter](https://github.com/swlynch99/cargo-sweep-action/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/swlynch99/cargo-sweep-action/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/swlynch99/cargo-sweep-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/swlynch99/cargo-sweep-action/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/swlynch99/cargo-sweep-action/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/swlynch99/cargo-sweep-action/workflows/codeql-analysis.yml)

Run [cargo-sweep] as part of your CI. When caching the target directory you
usually want to continue from an older cache when `Cargo.lock` is updated.
If you do this, however, then older artifacts can pile up in your `target`
directory.

This action will use [cargo-sweep] to automatically remove any artifacts that
were not used by the current job.

To use it, run it in your actions job _after_ running your cache action:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: dtolnay/rust-toolchain@stable
      
      # Restore the cache
      - uses: Swatinem/rust-cache@v2

      # ... then setup cargo-sweep
      - uses: swlynch99/cargo-sweep-action@v1

```

[cargo-sweep]: https://github.com/holmgr/cargo-sweep
