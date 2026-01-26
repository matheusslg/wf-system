# Changelog

All notable changes to wf-system will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-26

### Added
- Initial versioned release
- Update notification system with daily background checks
- `/wf-update` command for checking and applying updates
- Version tracking via `~/.claude/hooks/.wf-version`
- Install mode tracking (symlink vs copy)

### Changed
- Enhanced `install.sh` to write version metadata
- Updated orchestrator to check for updates daily
- Modified `/wf-start-session` to show update notices
