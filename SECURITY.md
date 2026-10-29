# Security Policy

## Supported versions

Only the latest release on `main` is supported.

## Reporting a vulnerability

**Do not open a public issue.** Report privately through GitHub:
<https://github.com/soupler-oss/repo-governance/security/advisories/new>

Include what is affected, how to reproduce it, and the impact. You will get an acknowledgement, and a fix or an explanation, as soon as the maintainer can; please allow reasonable time before public disclosure.

## What counts

Because this tool writes files, runs `git` and `gh`, and installs git hooks and CI workflows into other people's repositories, the interesting classes are: path traversal or overwriting files outside the target folder, command injection through configuration values, generated workflows that expose secrets or run untrusted code with write tokens, and any way the tool could publish to GitHub without the explicit confirmation it promises.
