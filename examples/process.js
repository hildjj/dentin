'use strict'

const fs = require('fs')
const Dentin = require('../lib/dentin')
const opts = require('../.dentin.json')

;(async () => {
  const dir = (await fs.promises.readdir('.'))
    .filter(x => x.endsWith('.xml') || x.endsWith('.html'))
  dir.forEach(async f => {
    const s = await Dentin.dentFile(f, Object.assign({}, opts, {
      output: fs.createWriteStream(f + '.out'),
      colors: false,
      periodSpaces: 2
    }))
  })
})()

