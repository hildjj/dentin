'use strict'

exports.setChalkTheme = function setChalkTheme(chalk, theme) {
  for (const [typ, color] of Object.entries(theme)) {
    chalk[typ] = chalk[color] ||
      (Array.isArray(color) ?
        chalk.rgb(...color) :
        chalk.hex(color))
  }
}

exports.extract = function extract(obj, props) {
  if (!obj) {
    return null
  }
  const ret = {}
  if (props != null) {
    for (const p of props) {
      if (Object.prototype.hasOwnProperty.call(obj, p)) {
        ret[p] = obj[p]
      }
    }
  }
  return ret
}
