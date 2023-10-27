import { Settings } from 'sigma/settings';
import { NodeDisplayData, PartialButFor } from 'sigma/types';

function drawLabel(
  context: CanvasRenderingContext2D,
  data: PartialButFor<NodeDisplayData, 'x' | 'y' | 'size' | 'label' | 'color'>,
  settings: Settings
): void {
  if (!data.label) return;

  const size = data.labelSize || settings.labelSize;
  const font = settings.labelFont;
  const weight = settings.labelWeight;
  const color = data.labelColor || settings.labelColor.color;
  const labelOffsetX = data.labelOffsetX || 0;
  const labelOffsetY = data.labelOffsetY || 0;

  context.fillStyle = color;
  context.font = `${weight} ${size}px ${font}`;

  context.fillText(data.label, data.x + labelOffsetX + data.size + 3, data.y + labelOffsetY + size / 3);
}

function drawHover(
  context: CanvasRenderingContext2D,
  data: PartialButFor<NodeDisplayData, 'x' | 'y' | 'size' | 'label' | 'color'>,
  settings: Settings
): void {
  const size = data.labelSize || settings.labelSize;
  const font = settings.labelFont;
  const weight = settings.labelWeight;
  context.font = `${weight} ${size}px ${font}`;

  // Then we draw the label background
  context.fillStyle = "#FFF";
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.shadowBlur = 8;
  context.shadowColor = "#000";
  const PADDING = 2;

  context.beginPath();
  if (!data.label)
    context.arc(data.x, data.y, data.size + PADDING / 2, 0, Math.PI * 2);
  else {
    const textWidth = context.measureText(data.label).width;
    const boxWidth = Math.round(textWidth + 5);
    const boxHeight = Math.round(size + 2 * PADDING);
    const radius = Math.max(data.size, size / 2) + PADDING;
    const angleRadian = Math.asin(boxHeight / 2 / radius);
    const xShift = Math.sqrt(Math.abs(Math.pow(radius, 2) - Math.pow(boxHeight / 2, 2))),
      xMin = data.x + xShift,
      xMax = data.x + data.size + PADDING + boxWidth - boxHeight / 4,
      yMin = data.y - boxHeight / 2,
      yMax = data.y + boxHeight / 2;

    context.moveTo(xMin, yMax);
    context.lineTo(xMax, yMax);
    context.arc(xMax, data.y, boxHeight / 2, -Math.PI / 2, Math.PI / 2);
    context.lineTo(xMax, yMin);
    context.lineTo(xMin, yMin);
    context.arc(data.x, data.y, radius, angleRadian, -angleRadian);
  }
  context.closePath();
  context.fill();

  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.shadowBlur = 0;

  // And finally we draw the label
  drawLabel(context, data, settings);
}

export { drawLabel, drawHover };
