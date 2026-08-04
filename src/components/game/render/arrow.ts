// ============================================================================
// Venom Arena — Direction Arrow for Player Snake
// ============================================================================

/**
 * Draw a direction arrow in front of the player snake's head.
 * Extends further when boosting.
 */
export function drawDirectionArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  radius: number,
  isBoosting: boolean,
  color: string,
): void {
  const r = Math.max(2, radius);

  // Arrow extends further when boosting
  const distance = r * (isBoosting ? 1.8 : 1.3);
  const arrowLen = r * (isBoosting ? 0.7 : 0.5);
  const arrowWidth = r * 0.25;

  // Position arrow tip in front of head
  const tipX = x + Math.cos(angle) * distance;
  const tipY = y + Math.sin(angle) * distance;

  // Arrow base (closer to head)
  const baseX = x + Math.cos(angle) * (distance - arrowLen);
  const baseY = y + Math.sin(angle) * (distance - arrowLen);

  // Perpendicular direction for width
  const perpAngle = angle + Math.PI / 2;
  const halfW = arrowWidth / 2;

  ctx.save();
  ctx.globalAlpha = isBoosting ? 0.9 : 0.6;
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;

  // Draw arrow shape
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    baseX + Math.cos(perpAngle) * halfW,
    baseY + Math.sin(perpAngle) * halfW,
  );
  ctx.lineTo(
    baseX - Math.cos(perpAngle) * halfW,
    baseY - Math.sin(perpAngle) * halfW,
  );
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}
