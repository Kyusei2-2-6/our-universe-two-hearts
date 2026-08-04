function fileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `our-universe-${stamp}.png`;
}

function saveBlob(blob, name = fileName()) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function captureCurrentView({ galaxy } = {}) {
  const ignored = [...document.querySelectorAll('[data-capture-ignore="true"]')];
  ignored.forEach(node => node.style.visibility = 'hidden');
  try {
    const module = await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm');
    const html2canvas = module.default || module;
    const canvas = await html2canvas(document.body, {
      backgroundColor:'#02030a',
      useCORS:true,
      allowTaint:false,
      logging:false,
      scale:Math.min(2, Math.max(1, devicePixelRatio || 1)),
      width:innerWidth,
      height:innerHeight,
      windowWidth:innerWidth,
      windowHeight:innerHeight,
      scrollX:0,
      scrollY:-scrollY,
      ignoreElements:element=>element.dataset?.captureIgnore==='true'
    });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1));
    if (!blob) throw new Error('Gambar tidak dapat dibuat.');
    saveBlob(blob);
    return true;
  } catch (error) {
    const blob = await galaxy?.captureFrame?.();
    if (!blob) throw error;
    saveBlob(blob);
    return true;
  } finally {
    ignored.forEach(node => node.style.visibility = '');
  }
}
