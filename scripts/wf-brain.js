#!/usr/bin/env node
'use strict';

const { run } = require('./wf-brain/cli');
run(process.argv).catch(err => {
  console.log(JSON.stringify({ error: err.message }));
  process.exitCode = 1;
});
