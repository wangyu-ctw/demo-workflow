type ExecutorPayload = Record<string, unknown>;

const generateImage = async (payload: ExecutorPayload) => {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return "";
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  ctx.font = "10px sans-serif";
  ctx.textBaseline = "top";
  const text = JSON.stringify(payload);
  const padding = 10;
  const maxWidth = canvas.width - padding * 2;
  const maxHeight = canvas.height - padding * 2;
  const lineHeight = 14;
  let currentLine = "";
  let y = padding;
  const cleanupCanvas = () => {
    canvas.width = 0;
    canvas.height = 0;
  };
  const flushLine = () => {
    if (!currentLine) {
      return true;
    }
    if (y + lineHeight > padding + maxHeight) {
      return false;
    }
    ctx.fillText(currentLine, padding, y);
    y += lineHeight;
    currentLine = "";
    return true;
  };
  for (const ch of text) {
    const testLine = currentLine + ch;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      if (!flushLine()) {
        const dataUrl = canvas.toDataURL("image/png");
        cleanupCanvas();
        return dataUrl;
      }
      currentLine = ch;
    } else {
      currentLine = testLine;
    }
  }
  flushLine();
  const dataUrl = canvas.toDataURL("image/png");
  cleanupCanvas();
  return dataUrl;
};

const generatePrompt = async (_payload: ExecutorPayload) => {
  const string= JSON.stringify(_payload);
  const cleanedString = string.replace(/"/g, "").replace(/{/g, "").replace(/}/g, "").replace(/:/g, "").replace(/,/g, "").replace(/\s/g, "").replace(/\n/g, "");
  return `enhanced: ${cleanedString}`;
};

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const executor = async (id: number, payload: ExecutorPayload) => {
  let result: unknown;
  switch (id) {
    case 1:
      result = await generateImage(payload);
      break;
    case 2:
      result = await generatePrompt(payload);
      break;
    default:
      result = payload;
  }
  await delay(10000);
  return result;
};
