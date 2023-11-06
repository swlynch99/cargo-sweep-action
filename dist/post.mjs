import {
  __toESM,
  require_core,
  require_exec
} from "./chunk-ZYYGX4RU.mjs";

// src/post.ts
var core = __toESM(require_core());
var exec = __toESM(require_exec());
async function sweep() {
  core.startGroup("run cargo-sweep");
  exec.exec("cargo", ["sweep", "-f"]);
  core.endGroup();
}
sweep();
//# sourceMappingURL=post.mjs.map
