// ============================================================================
// Venom Arena — Face Drawing (Eyes, Pupils, Nose, Mouth, Specular Highlight)
// ============================================================================

/**
 * Draw the full face on a snake head.
 * Eyes are offset based on angle so they always face forward.
 * Pupils track toward the movement direction.
 */
export function drawFace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  angle: number,
  _time: number,
): void {
  const r = Math.max(2, radius);

  // Eye parameters
  const eyeOffset = r * 0.35;       // distance from center to each eye
  const eyeRadius = r * 0.30;       // white of the eye
  const pupilRadius = r * 0.17;     // dark pupil
  const pupilShift = r * 0.08;      // how far pupil shifts toward direction

  // Perpendicular offset for left/right eyes
  const perpAngle = angle + Math.PI / 2;

  // Forward offset (eyes sit further forward on elongated head)
  const fwdX = Math.cos(angle) * r * 0.2;
  const fwdY = Math.sin(angle) * r * 0.2;

  // Left eye center
  const lx = x + fwdX + Math.cos(perpAngle) * eyeOffset;
  const ly = y + fwdY + Math.sin(perpAngle) * eyeOffset;

  // Right eye center
  const rx = x + fwdX - Math.cos(perpAngle) * eyeOffset;
  const ry = y + fwdY - Math.sin(perpAngle) * eyeOffset;

  // Pupil direction (smooth track toward movement direction)
  const pShiftX = Math.cos(angle) * pupilShift;
  const pShiftY = Math.sin(angle) * pupilShift;

  // ── Draw eyes (white) ───────────────────────────────────────────────
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(lx, ly, eyeRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(rx, ry, eyeRadius, 0, Math.PI * 2);
  ctx.fill();

  // ── Draw pupils (dark) ──────────────────────────────────────────────
  ctx.fillStyle = '#111111';
  ctx.beginPath();
  ctx.arc(lx + pShiftX, ly + pShiftY, pupilRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(rx + pShiftX, ry + pShiftY, pupilRadius, 0, Math.PI * 2);
  ctx.fill();

  // ── Nose (two small dots at the tip of elongated head) ──────────
  const noseOffset = r * 0.35;
  const noseX = x + Math.cos(angle) * noseOffset;
  const noseY = y + Math.sin(angle) * noseOffset;
  const noseDotR = r * 0.06;
  const noseSpread = r * 0.1;

  ctx.fillStyle = '#333333';
  ctx.beginPath();
  ctx.arc(
    noseX + Math.cos(perpAngle) * noseSpread,
    noseY + Math.sin(perpAngle) * noseSpread,
    noseDotR,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.beginPath();
  ctx.arc(
    noseX - Math.cos(perpAngle) * noseSpread,
    noseY - Math.sin(perpAngle) * noseSpread,
    noseDotR,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  // ── Mouth (smile arc at the very front) ──────────────────────────────
  const mouthDist = r * 0.55;
  const mouthX = x + Math.cos(angle) * mouthDist;
  const mouthY = y + Math.sin(angle) * mouthDist;
  const mouthW = r * 0.28;

  ctx.strokeStyle = '#333333';
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.lineCap = 'round';

  ctx.beginPath();
  // Smile arc perpendicular to movement direction
  const mouthAngle = angle + Math.PI / 2;
  ctx.arc(
    mouthX,
    mouthY,
    mouthW,
    mouthAngle - Math.PI * 0.7,
    mouthAngle + Math.PI * 0.7,
  );
  ctx.stroke();

  // ── Specular Highlight (top-left light) ─────────────────────────────
  const specR = r * 0.15;
  const specX = x - r * 0.25;
  const specY = y - r * 0.3;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.arc(specX, specY, specR, 0, Math.PI * 2);
  ctx.fill();
}
