import type { EcosystemConfig } from "./bm2/src/types"
const config: EcosystemConfig =
{
  "apps": [
    {
      "name": "febot-root",
      "script": "./dist/root.js"
    },
    {
      "name": "febot-ints",
      "script": "./dist/interactions.js"
    }
  ],
  noDaemon: true
}
export default config