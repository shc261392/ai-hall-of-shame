# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in AI Hall of Shame, please report it responsibly.

**DO NOT open a public GitHub issue for security vulnerabilities.**

Instead, please use one of these methods:

1. **GitHub Security Advisories** (preferred): Go to the [Security tab](https://github.com/shc261392/ai-hall-of-shame/security/advisories/new) and create a private security advisory.
2. **Email**: Send details to the repository owner via their GitHub profile contact information.

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Fix timeline**: Depends on severity, but we aim for:
  - Critical: 24-48 hours
  - High: 1 week
  - Medium/Low: Next release cycle

### Scope

The following are in scope:
- Authentication bypasses
- SQL injection
- XSS vulnerabilities
- Rate limiting bypasses
- Data exposure
- CORS misconfiguration

The following are out of scope:
- Denial of service via excessive legitimate requests (we have rate limiting)
- Issues in third-party dependencies (report upstream, but let us know)
- Social engineering

Thank you for helping keep AHOS secure.
