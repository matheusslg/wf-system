'use strict';

const DECISION_PATTERNS = [
  /\bdecision\b/i,
  /\bchose\b/i,
  /\bbecause\b/i,
  /\binstead of\b/i,
  /\bswitched to\b/i,
  /\bwent with\b/i,
  /\bpicked\b/i,
  /\bover\b.*\bfor\b/i
];

function parseStandards(content) {
  const sections = content.split(/^## /m).slice(1);
  const entries = [];

  for (const section of sections) {
    if (entries.length >= 20) break;

    const lines = section.split('\n');
    const heading = lines[0].trim();
    const body = lines.slice(1).join('\n').trim();

    if (body.length < 30 || body.length > 500) continue;

    const tags = heading.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/).join(',');

    entries.push({
      content: body,
      category: 'convention',
      tags,
      source: 'seed:standards.md'
    });
  }

  return entries;
}

function parseProgress(content) {
  const entries = [];
  const paragraphs = content.split(/\n(?=##\s)/);

  for (const para of paragraphs) {
    if (entries.length >= 10) break;

    const hasDecision = DECISION_PATTERNS.some(p => p.test(para));
    if (!hasDecision) continue;

    const lines = para.split('\n').filter(l => l.trim());
    const heading = lines[0] || '';

    const decisionLines = lines.filter(l =>
      DECISION_PATTERNS.some(p => p.test(l))
    );

    if (decisionLines.length === 0) continue;

    const decisionContent = decisionLines.join(' ').replace(/\*\*/g, '').trim();
    if (decisionContent.length < 20 || decisionContent.length > 500) continue;

    const category = /\bswitch/i.test(decisionContent) || /\binstead of/i.test(decisionContent)
      ? 'decision' : 'history';

    const tags = heading.replace(/^#+\s*/, '').toLowerCase()
      .replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/).slice(0, 3).join(',');

    entries.push({
      content: decisionContent,
      category,
      tags: tags || 'progress',
      source: 'seed:progress.md'
    });
  }

  return entries;
}

module.exports = { parseStandards, parseProgress };
