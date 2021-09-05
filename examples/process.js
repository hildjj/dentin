'use strict'

const fs = require('fs')
const Dentin = require('../lib/dentin')
const opts = require('../.dentin.json')

;(async() => {
  const dir = (await fs.promises.readdir('.'))
    .filter(x => x.endsWith('.xml') || x.endsWith('.html'))
  for (const f of dir) {
    const str = await Dentin.dentFile(f, {
      ...opts,
      colors: false,
      periodSpaces: 2,
    })
    await fs.promises.writeFile(`${f}.out`, str, "utf8")
  }
})()

