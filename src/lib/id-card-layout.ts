interface Rectangle {
  x: number
  y: number
  width: number
  height: number
}

export interface IdCardSheetLayout {
  front: Rectangle
  back: Rectangle
}

export function getIdCardSheetLayout(canvasWidth: number, canvasHeight: number): IdCardSheetLayout {
  // Convert physical millimeters to pixels on an A4 sheet.
  const cardWidth = canvasWidth * (85.6 / 210)
  const cardHeight = canvasHeight * (53.98 / 297)
  const gap = canvasHeight * (15 / 297)
  const x = (canvasWidth - cardWidth) / 2
  const frontY = (canvasHeight - cardHeight * 2 - gap) / 2

  return {
    front: { x, y: frontY, width: cardWidth, height: cardHeight },
    back: { x, y: frontY + cardHeight + gap, width: cardWidth, height: cardHeight },
  }
}
