#!/usr/bin/env node
// Post-version hook: sync version from package.json → openclaw.plugin.json, SKILL.md, SDK
import { readFileSync, writeFileSync } from 'fs'

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))

const plugin = JSON.parse(readFileSync('openclaw.plugin.json', 'utf8'))
plugin.version = version
writeFileSync('openclaw.plugin.json', JSON.stringify(plugin, null, 2) + '\n')

let skill = readFileSync('skills/dap/SKILL.md', 'utf8')
skill = skill.replace(/^version: .*/m, `version: "${version}"`)
writeFileSync('skills/dap/SKILL.md', skill)

const sdkPkg = JSON.parse(readFileSync('packages/agent-world-sdk/package.json', 'utf8'))
sdkPkg.version = version
writeFileSync('packages/agent-world-sdk/package.json', JSON.stringify(sdkPkg, null, 2) + '\n')

console.log(`Synced version ${version} → openclaw.plugin.json, skills/dap/SKILL.md, packages/agent-world-sdk/package.json`)
