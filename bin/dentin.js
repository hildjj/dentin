#!/usr/bin/env node

import {CLI} from '../lib/cmd.js';
new CLI()
  .cmd(process.argv.slice(2))
  .catch(console.error);
