import fs from 'fs'

export const validatePath = (path: string): string => {
  if (!fs.existsSync(path)) {
    throw new Error(`path not found: ${path}`)
  }
  return path
}

export function validateIsNumber(value: any): number {
  const shouldBeNum = parseInt(value, 10)
  if (isNaN(shouldBeNum)) {
    throw new Error(`invalid number: ${value}`)
  }
  return shouldBeNum
}
