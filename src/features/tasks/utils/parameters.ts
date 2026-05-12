import type { TaskParameter } from '@shared/types'

const UNIT_MAP: Record<string, string> = {
  'km/h': 'km/h',
  'm/s': 'm/s',
  km: 'km',
  m: 'm',
  cm: 'cm',
  mm: 'mm',
  h: 'h',
  min: 'min',
  s: 's',
  sek: 's',
  kg: 'kg',
  g: 'g',
  l: 'l',
  ml: 'ml',
  '°C': '°C',
  K: 'K',
  N: 'N',
  J: 'J',
  W: 'W',
  Pa: 'Pa',
  V: 'V',
  A: 'A',
  Ω: 'Ω',
  zł: 'zł',
  PLN: 'zł',
  $: '$',
  '€': '€',
  '%': '%',
}

const UNIT_ALIASES: Record<string, string> = {
  kilometrow: 'km',
  kilometry: 'km',
  kilometr: 'km',
  metrow: 'm',
  metry: 'm',
  metr: 'm',
  gramow: 'g',
  gramy: 'g',
  gram: 'g',
  kilogramow: 'kg',
  kilogramy: 'kg',
  kilogram: 'kg',
  godzin: 'h',
  godziny: 'h',
  godzina: 'h',
  minut: 'min',
  minuty: 'min',
  minuta: 'min',
  sekund: 's',
  sekundy: 's',
  sekunda: 's',
  stopni: '°C',
  stopnie: '°C',
  procent: '%',
  procenty: '%',
}

export function detectParameters(text: string): TaskParameter[] {
  const params: TaskParameter[] = []
  const found = new Set<string>()
  let serial = 0

  // Pattern: number + optional space + unit
  const patterns = [
    // Decimal numbers with units: 20 km/h, 3.5 m/s, 100 zł
    /(\d+(?:[.,]\d+)?)\s*\s?(km\/h|m\/s|km|cm|mm|m|h|min|sek\.?|s|kg|g|l|ml|°C|K|N|J|W|Pa|V|A|Ω|zł|PLN|\$|€|%)/gi,
    // Integer numbers followed by spelled-out units or context
    /(\d+(?:[.,]\d+)?)\s*(kilometr[óway]?|metr[óway]?|kilogram[óway]?|gram[óway]?|godzin[ay]?|minut[ay]?|sekund[ay]?|stopni[ae]?|procent)/gi,
  ]

  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const rawValue = match[1].replace(',', '.')
      const rawUnit = match[2]
      const value = parseFloat(rawValue)
      const unit = UNIT_MAP[rawUnit] || UNIT_ALIASES[rawUnit.toLowerCase()] || rawUnit

      if (isNaN(value)) continue

      const key = `${value}-${unit}-${match.index}`
      if (found.has(key)) continue
      found.add(key)

      // Smart name from context
      let name = `${unit} parameter`
      const before = text.slice(Math.max(0, match.index - 60), match.index)
      const contextWords = before.split(/\s+/).slice(-6)
      if (contextWords.length > 0) {
        const lastWord = contextWords[contextWords.length - 1]
        if (lastWord.length > 2 && !/^(z|na|po|do|o|w|i|a|the|a|an)$/i.test(lastWord)) {
          name = `${lastWord} (${unit})`
        }
      }

      const isInteger = Number.isInteger(value)
      const min = isInteger
        ? Math.max(1, Math.floor(value * 0.3))
        : Math.max(0.1, +(value * 0.3).toFixed(2))
      const max = isInteger ? Math.ceil(value * 2.5) : +(value * 2.5).toFixed(2)
      const step = isInteger ? 1 : +(max / 20).toFixed(2)

      params.push({
        id: `auto-${match.index}-${serial++}`,
        name,
        type: isInteger ? 'integer' : 'number',
        value,
        unit,
        min,
        max,
        step,
        isAutoDetected: true,
      })
    }
  }

  // Currency and percentages: standalone numbers before % or currency symbols
  const standalonePattern = /(?:^|\s)(\d+(?:[.,]\d+)?)\s*([%€$zł]|PLN)(?![a-zA-Z])/gi
  let sMatch: RegExpExecArray | null
  while ((sMatch = standalonePattern.exec(text)) !== null) {
    const rawValue = sMatch[1].replace(',', '.')
    const unit = sMatch[2] === 'zł' || sMatch[2] === 'PLN' ? 'zł' : sMatch[2]
    const value = parseFloat(rawValue)
    if (isNaN(value)) continue

    const key = `${value}-${unit}-${sMatch.index}`
    if (found.has(key)) continue
    found.add(key)

    const isInteger = Number.isInteger(value)
    const min = isInteger
      ? Math.max(1, Math.floor(value * 0.2))
      : Math.max(0.1, +(value * 0.2).toFixed(2))
    const max = isInteger ? Math.ceil(value * 3) : +(value * 3).toFixed(2)
    const step = isInteger ? 1 : +(max / 25).toFixed(2)

    params.push({
      id: `auto-s-${sMatch.index}-${serial++}`,
      name: `Wartość (${unit})`,
      type: isInteger ? 'integer' : 'number',
      value,
      unit,
      min,
      max,
      step,
      isAutoDetected: true,
    })
  }

  return params
}

export function applyParameters(content: string, parameters: TaskParameter[]): string {
  let result = content
  // Sort by value descending to avoid partial replacements
  const sorted = [...parameters].sort((a, b) => {
    const av = typeof a.value === 'number' ? a.value : parseFloat(String(a.value))
    const bv = typeof b.value === 'number' ? b.value : parseFloat(String(b.value))
    return bv - av
  })

  for (const p of sorted) {
    const valStr = typeof p.value === 'number' ? String(p.value).replace('.', ',') : String(p.value)
    const regex = new RegExp(
      `(\\D|^)(${valStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(\\s*${p.unit ? p.unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : ''})?(\\D|$)`,
      'g',
    )
    result = result.replace(regex, (_m, before, _v, _u, after) => {
      return `${before}{{${p.id}}}${after}`
    })
  }
  return result
}

export function renderParameterized(content: string, parameters: TaskParameter[]): string {
  let result = content
  for (const p of parameters) {
    const valStr =
      typeof p.value === 'number'
        ? Number.isInteger(p.value)
          ? String(p.value)
          : p.value.toFixed(2).replace('.', ',')
        : String(p.value)
    const display = p.unit ? `${valStr} ${p.unit}` : valStr
    result = result.replace(new RegExp(`\\{\\{${p.id}\\}\\}`, 'g'), display)
  }
  return result
}

export function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function randomizeParameter(p: TaskParameter): TaskParameter {
  if (p.type === 'text' || p.type === 'choice') return { ...p }
  if (p.min === undefined || p.max === undefined) return { ...p }

  let value: number
  if (p.type === 'integer') {
    const min = Math.ceil(p.min)
    const max = Math.floor(p.max)
    value = Math.floor(Math.random() * (max - min + 1)) + min
  } else {
    const step = p.step || 0.01
    const steps = Math.floor((p.max - p.min) / step)
    value = +(p.min + Math.floor(Math.random() * (steps + 1)) * step).toFixed(4)
    if (value > p.max) value = p.max
  }

  return { ...p, value }
}
