# Changelog

## [0.1.5](https://github.com/MonsieurBarti/gitnexus-pi/compare/gitnexus-pi-v0.1.4...gitnexus-pi-v0.1.5) (2026-04-12)


### Bug Fixes

* add refactor commit type to release-please config ([38aa6a9](https://github.com/MonsieurBarti/gitnexus-pi/commit/38aa6a9f6b0c95378361c96065277309e5d235c7))


### Refactors

* compress skill files to symbolic notation ([f5cdbed](https://github.com/MonsieurBarti/gitnexus-pi/commit/f5cdbedbad5290f7ff22cb576555a4aacae668f8))
* **skills:** compress skill files to symbolic notation ([09a8b27](https://github.com/MonsieurBarti/gitnexus-pi/commit/09a8b275071e698807ff37650cd29757d6a0d215))
* **skills:** compress to symbolic notation ([7dbb548](https://github.com/MonsieurBarti/gitnexus-pi/commit/7dbb54874c620c40a277779bc3be3297dc006248))

## [0.1.4](https://github.com/MonsieurBarti/gitnexus-pi/compare/gitnexus-pi-v0.1.3...gitnexus-pi-v0.1.4) (2026-04-11)


### Features

* add update notification on session_start ([31dfc21](https://github.com/MonsieurBarti/gitnexus-pi/commit/31dfc214136f6ffdba67cdcfe9ae0b502a56c36a))
* add update notification on session_start ([17ce2f0](https://github.com/MonsieurBarti/gitnexus-pi/commit/17ce2f0ff8359ef3d5c383adee3df152fdebc33f))

## [0.1.3](https://github.com/MonsieurBarti/gitnexus-pi/compare/gitnexus-pi-v0.1.2...gitnexus-pi-v0.1.3) (2026-04-11)


### Features

* add read-only classification to tool definitions ([da31ded](https://github.com/MonsieurBarti/gitnexus-pi/commit/da31ded773aeacb89a825391ad3341b7fb7fded5))
* add readOnly classification to tool definitions ([264fc75](https://github.com/MonsieurBarti/gitnexus-pi/commit/264fc758fdccfed6ba71387f7441dbe2862715d6))

## [0.1.2](https://github.com/MonsieurBarti/gitnexus-pi/compare/gitnexus-pi-v0.1.1...gitnexus-pi-v0.1.2) (2026-04-10)


### Features

* add /gitnexus-index command with gitignore guard ([16cbbea](https://github.com/MonsieurBarti/gitnexus-pi/commit/16cbbeac9184115bb9617d9bf06a34473ddc49b0))
* add /gitnexus-status command with session counters ([c922138](https://github.com/MonsieurBarti/gitnexus-pi/commit/c9221385759336af02fedee9ce13908e842de40f))
* add 3 shipped skills (scope-refactor, pre-commit-review, explore-codebase) ([3101675](https://github.com/MonsieurBarti/gitnexus-pi/commit/3101675f6cea5d5384d5c9b07daa86b896eb03f4))
* add error classes and user-facing message catalog ([45362b0](https://github.com/MonsieurBarti/gitnexus-pi/commit/45362b0cb5ec8268e51d5e06d21ca5cd2e64c912))
* add gitignore guard ensuring .gitnexus is excluded ([57e0f1e](https://github.com/MonsieurBarti/gitnexus-pi/commit/57e0f1edd953ada887606a6a13eed063b5827fb8))
* add gitnexus binary resolver with shell fallback ([5d64679](https://github.com/MonsieurBarti/gitnexus-pi/commit/5d64679bf90d2b73c063806e4111129659288024))
* add gitnexus-context tool (360° symbol view) ([4f14e77](https://github.com/MonsieurBarti/gitnexus-pi/commit/4f14e773f2b3523449511a4d65cb8c99b050c123))
* add gitnexus-cypher tool (raw Cypher escape hatch) ([1207193](https://github.com/MonsieurBarti/gitnexus-pi/commit/12071930e2c6cb82db60425b20a728a78e57919e))
* add gitnexus-detect-changes tool (git diff → affected processes) ([bfc95fa](https://github.com/MonsieurBarti/gitnexus-pi/commit/bfc95fac09f3ef65182f9d20166a94db8188bda7))
* add gitnexus-impact tool (blast radius analysis) ([0b9e7d6](https://github.com/MonsieurBarti/gitnexus-pi/commit/0b9e7d6073e8e578e213423a6e1110490651dabd))
* add gitnexus-list-repos tool (enumerate indexed repos) ([e70b601](https://github.com/MonsieurBarti/gitnexus-pi/commit/e70b601601a2ab5cc799978f57ee9d335c516ef3))
* add grep tool_result augment hook ([07352b3](https://github.com/MonsieurBarti/gitnexus-pi/commit/07352b332dd40ef50d3a4bfbb63d7a62b1ca8215))
* add per-session augment cache ([dd732d5](https://github.com/MonsieurBarti/gitnexus-pi/commit/dd732d54fe793a83805472d62f554f4efbadf8da))
* add persistent gitnexus mcp stdio client ([7489da7](https://github.com/MonsieurBarti/gitnexus-pi/commit/7489da7f6554e69e11e14b7c3a9979060dfa6b39))
* add repo discovery walking up from cwd ([5f60790](https://github.com/MonsieurBarti/gitnexus-pi/commit/5f60790d3a6b67b8ef679612dba6b0fbfd310a4d))
* add resolveRepoRoot helper and resolve-repo fake ([d595447](https://github.com/MonsieurBarti/gitnexus-pi/commit/d5954472872ca38c46570fa7967b048fbeefca00))
* add skills directory to package.json files and pi.skills manifest ([fb044fa](https://github.com/MonsieurBarti/gitnexus-pi/commit/fb044fa9a249092374c37438abe2aec57dc952b1))
* add tff-gitnexus_query tool ([396b371](https://github.com/MonsieurBarti/gitnexus-pi/commit/396b371a07afa5735c79e723e8fca7bd158f5558))
* expand augment hook to grep+find+read with toggle and counters ([b48701c](https://github.com/MonsieurBarti/gitnexus-pi/commit/b48701c461b6e20d30434e75cbae327f6601d3d3))
* expand gitnexus-query with task_context, goal, include_content and resolveRepo ([0a7010a](https://github.com/MonsieurBarti/gitnexus-pi/commit/0a7010a2fa98a43f34374fd6e877603035cecf54))
* gitnexus-pi v0.1.0 + v0.2.0 curated MVP ([b1cc44e](https://github.com/MonsieurBarti/gitnexus-pi/commit/b1cc44e8847cc5d09f9d00ac44bc6abb77587393))
* wire extension factory with tool, command, and hook ([31cc319](https://github.com/MonsieurBarti/gitnexus-pi/commit/31cc319b647805b19898829c33f46b7c82160c68))
* wire v0.2 tools, commands, toggle, and session_start notify in index.ts ([02d506e](https://github.com/MonsieurBarti/gitnexus-pi/commit/02d506e842c5b333eb47b027b8d2a3d3377d1ff9))


### Bug Fixes

* clean up abort listeners when mcp child errors ([22017e3](https://github.com/MonsieurBarti/gitnexus-pi/commit/22017e38e4648ea29afe1a622c4d59748dae6c32))
* correct pi api field names and use resolved binary path ([e19cc6d](https://github.com/MonsieurBarti/gitnexus-pi/commit/e19cc6de587d2bc7157f02e8b6a1b89123c07e9c))
* drop .ts extensions from relative imports for build ([b80674b](https://github.com/MonsieurBarti/gitnexus-pi/commit/b80674b026ffb630623c8eb361bb4968b3bd7544))
* guard augment hook against non-array content ([c9ee613](https://github.com/MonsieurBarti/gitnexus-pi/commit/c9ee6139860d7f14d4c015e715c99b10475dc220))
* pass --skip-agents-md to gitnexus analyze ([4739816](https://github.com/MonsieurBarti/gitnexus-pi/commit/473981612d78a83a0cc3f81b8777c9eb59c96a52))
* use space indentation in workflow yaml files ([5b1391f](https://github.com/MonsieurBarti/gitnexus-pi/commit/5b1391f9d52bfdb06dd341d176e34ea5b1d3203a))

## [0.1.1](https://github.com/MonsieurBarti/gitnexus-pi/compare/gitnexus-pi-v0.1.0...gitnexus-pi-v0.1.1) (2026-04-10)


### Features

* add /gitnexus-index command with gitignore guard ([16cbbea](https://github.com/MonsieurBarti/gitnexus-pi/commit/16cbbeac9184115bb9617d9bf06a34473ddc49b0))
* add /gitnexus-status command with session counters ([c922138](https://github.com/MonsieurBarti/gitnexus-pi/commit/c9221385759336af02fedee9ce13908e842de40f))
* add 3 shipped skills (scope-refactor, pre-commit-review, explore-codebase) ([3101675](https://github.com/MonsieurBarti/gitnexus-pi/commit/3101675f6cea5d5384d5c9b07daa86b896eb03f4))
* add error classes and user-facing message catalog ([45362b0](https://github.com/MonsieurBarti/gitnexus-pi/commit/45362b0cb5ec8268e51d5e06d21ca5cd2e64c912))
* add gitignore guard ensuring .gitnexus is excluded ([57e0f1e](https://github.com/MonsieurBarti/gitnexus-pi/commit/57e0f1edd953ada887606a6a13eed063b5827fb8))
* add gitnexus binary resolver with shell fallback ([5d64679](https://github.com/MonsieurBarti/gitnexus-pi/commit/5d64679bf90d2b73c063806e4111129659288024))
* add gitnexus-context tool (360° symbol view) ([4f14e77](https://github.com/MonsieurBarti/gitnexus-pi/commit/4f14e773f2b3523449511a4d65cb8c99b050c123))
* add gitnexus-cypher tool (raw Cypher escape hatch) ([1207193](https://github.com/MonsieurBarti/gitnexus-pi/commit/12071930e2c6cb82db60425b20a728a78e57919e))
* add gitnexus-detect-changes tool (git diff → affected processes) ([bfc95fa](https://github.com/MonsieurBarti/gitnexus-pi/commit/bfc95fac09f3ef65182f9d20166a94db8188bda7))
* add gitnexus-impact tool (blast radius analysis) ([0b9e7d6](https://github.com/MonsieurBarti/gitnexus-pi/commit/0b9e7d6073e8e578e213423a6e1110490651dabd))
* add gitnexus-list-repos tool (enumerate indexed repos) ([e70b601](https://github.com/MonsieurBarti/gitnexus-pi/commit/e70b601601a2ab5cc799978f57ee9d335c516ef3))
* add grep tool_result augment hook ([07352b3](https://github.com/MonsieurBarti/gitnexus-pi/commit/07352b332dd40ef50d3a4bfbb63d7a62b1ca8215))
* add per-session augment cache ([dd732d5](https://github.com/MonsieurBarti/gitnexus-pi/commit/dd732d54fe793a83805472d62f554f4efbadf8da))
* add persistent gitnexus mcp stdio client ([7489da7](https://github.com/MonsieurBarti/gitnexus-pi/commit/7489da7f6554e69e11e14b7c3a9979060dfa6b39))
* add repo discovery walking up from cwd ([5f60790](https://github.com/MonsieurBarti/gitnexus-pi/commit/5f60790d3a6b67b8ef679612dba6b0fbfd310a4d))
* add resolveRepoRoot helper and resolve-repo fake ([d595447](https://github.com/MonsieurBarti/gitnexus-pi/commit/d5954472872ca38c46570fa7967b048fbeefca00))
* add skills directory to package.json files and pi.skills manifest ([fb044fa](https://github.com/MonsieurBarti/gitnexus-pi/commit/fb044fa9a249092374c37438abe2aec57dc952b1))
* add tff-gitnexus_query tool ([396b371](https://github.com/MonsieurBarti/gitnexus-pi/commit/396b371a07afa5735c79e723e8fca7bd158f5558))
* expand augment hook to grep+find+read with toggle and counters ([b48701c](https://github.com/MonsieurBarti/gitnexus-pi/commit/b48701c461b6e20d30434e75cbae327f6601d3d3))
* expand gitnexus-query with task_context, goal, include_content and resolveRepo ([0a7010a](https://github.com/MonsieurBarti/gitnexus-pi/commit/0a7010a2fa98a43f34374fd6e877603035cecf54))
* gitnexus-pi v0.1.0 + v0.2.0 curated MVP ([b1cc44e](https://github.com/MonsieurBarti/gitnexus-pi/commit/b1cc44e8847cc5d09f9d00ac44bc6abb77587393))
* wire extension factory with tool, command, and hook ([31cc319](https://github.com/MonsieurBarti/gitnexus-pi/commit/31cc319b647805b19898829c33f46b7c82160c68))
* wire v0.2 tools, commands, toggle, and session_start notify in index.ts ([02d506e](https://github.com/MonsieurBarti/gitnexus-pi/commit/02d506e842c5b333eb47b027b8d2a3d3377d1ff9))


### Bug Fixes

* clean up abort listeners when mcp child errors ([22017e3](https://github.com/MonsieurBarti/gitnexus-pi/commit/22017e38e4648ea29afe1a622c4d59748dae6c32))
* correct pi api field names and use resolved binary path ([e19cc6d](https://github.com/MonsieurBarti/gitnexus-pi/commit/e19cc6de587d2bc7157f02e8b6a1b89123c07e9c))
* drop .ts extensions from relative imports for build ([b80674b](https://github.com/MonsieurBarti/gitnexus-pi/commit/b80674b026ffb630623c8eb361bb4968b3bd7544))
* guard augment hook against non-array content ([c9ee613](https://github.com/MonsieurBarti/gitnexus-pi/commit/c9ee6139860d7f14d4c015e715c99b10475dc220))
* pass --skip-agents-md to gitnexus analyze ([4739816](https://github.com/MonsieurBarti/gitnexus-pi/commit/473981612d78a83a0cc3f81b8777c9eb59c96a52))
* use space indentation in workflow yaml files ([5b1391f](https://github.com/MonsieurBarti/gitnexus-pi/commit/5b1391f9d52bfdb06dd341d176e34ea5b1d3203a))
