const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const seed = require('../wf-brain/seed');

describe('wf-brain seed', () => {
  describe('parseStandards', () => {
    it('splits on ## headings and extracts entries', () => {
      const content = `# Code Standards

## General

Follow existing patterns in the codebase. Write tests for new functionality. Keep functions small.

## Commits

Use conventional commits: type(scope): description. Types: feat, fix, refactor, docs, test, chore.

## Too Short

Hi.
`;
      const entries = seed.parseStandards(content);
      assert.strictEqual(entries.length, 2);
      assert.strictEqual(entries[0].category, 'convention');
      assert.ok(entries[0].content.includes('Follow existing'));
      assert.ok(entries[0].tags.includes('general'));
      assert.strictEqual(entries[1].category, 'convention');
      assert.ok(entries[1].content.includes('conventional commits'));
    });

    it('limits to 20 entries max', () => {
      let content = '# Standards\n';
      for (let i = 0; i < 30; i++) {
        content += `\n## Section ${i}\n\n${'A'.repeat(60)}\n`;
      }
      const entries = seed.parseStandards(content);
      assert.ok(entries.length <= 20);
    });

    it('skips entries over 500 characters', () => {
      const content = `# Standards\n\n## Verbose\n\n${'A'.repeat(501)}\n\n## Short\n\nKeep it simple and focused on the task at hand.\n`;
      const entries = seed.parseStandards(content);
      assert.strictEqual(entries.length, 1);
      assert.ok(entries[0].content.includes('Keep it simple'));
    });
  });

  describe('parseProgress', () => {
    it('extracts decision-like paragraphs', () => {
      const content = `# Progress

## Session 1
**Decisions**: Chose React over Vue because the team has more experience with it.

## Session 2
**Focus**: Implemented login page.
**Completed**: Login form, API integration.

## Session 3
**Decisions**: Switched to PostgreSQL instead of MongoDB for ACID compliance.
`;
      const entries = seed.parseProgress(content);
      assert.ok(entries.length >= 2);
      assert.ok(entries.some(e => e.content.includes('React over Vue')));
      assert.ok(entries.some(e => e.content.includes('PostgreSQL')));
    });

    it('limits to 10 entries max', () => {
      let content = '# Progress\n';
      for (let i = 0; i < 15; i++) {
        content += `\n## Session ${i}\n**Decisions**: Chose option ${i} because reason ${i}.\n`;
      }
      const entries = seed.parseProgress(content);
      assert.ok(entries.length <= 10);
    });

    it('returns empty for no decision-like content', () => {
      const content = '# Progress\n\n## Session 1\n**Focus**: Setup\n**Completed**: Init\n';
      const entries = seed.parseProgress(content);
      assert.strictEqual(entries.length, 0);
    });
  });
});
