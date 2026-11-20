export type LineDraft = {
  key: string
  description: string
  quantity: string
  unit: string
  unitPrice: string
}

export function emptyLineDraft(): LineDraft {
  return {
    key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    description: '',
    quantity: '1',
    unit: 'ea',
    unitPrice: '0',
  }
}

export function draftsToLineInputs(lines: LineDraft[]) {
  return lines
    .map((l) => ({
      description: l.description.trim(),
      quantity: Number(l.quantity) || 0,
      unit: l.unit.trim() || 'ea',
      unitPrice: Number(l.unitPrice) || 0,
    }))
    .filter((l) => l.description || l.quantity || l.unitPrice)
}
