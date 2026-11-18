/* Print all storybook steps in landscape A4 in a layout separate from the reader. */

/** Wait for print assets to load. Abort on failure or timeout to avoid printing with missing images. */
async function waitForPrintResources(document) {
  await Promise.all([
    document.fonts.ready,
    ...Array.from(document.images, (image) => image.decode()),
  ]);
}

/** Copy shared storybook content into a separate print document while preserving the reader's page and interaction state. */
export async function printStoryPages(source, title) {
  // The browser uses the document title as the default filename. Replace runs of whitespace with hyphens.
  const printTitle = title.trim().replace(/\s+/g, '-');
  const frame = document.createElement('iframe');
  frame.title = printTitle;
  frame.style.cssText = 'position:fixed;left:-100000px;top:0;width:1200px;height:800px;border:0';
  document.body.appendChild(frame);
  let timeout;
  let restorePrintState = () => {};
  try {
    const printDocument = frame.contentDocument;
    const printWindow = frame.contentWindow;
    printDocument.open();
    printDocument.write('<!doctype html><html><head></head><body></body></html>');
    printDocument.close();
    printDocument.title = printTitle;
    printDocument.documentElement.className = document.documentElement.className;
    printDocument.body.className = document.body.className;
    // Reuse page styles and fonts to keep one source for the storybook's visual styles.
    const stylesReady = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'), (node) => {
      const copy = node.cloneNode(true);
      const ready = node.tagName === 'LINK'
        ? new Promise((resolve, reject) => {
            copy.onload = resolve;
            copy.onerror = () => reject(new Error('Print stylesheet failed to load'));
          })
        : Promise.resolve();
      printDocument.head.appendChild(copy);
      return ready;
    });
    const style = printDocument.createElement('style');
    style.textContent = `
      /* Zero page margins suppress browser headers and footers. Page padding supplies whitespace. */
      @page { size: A4 landscape; margin: 0; }
      html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
      * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      /* Remove content from the cross-page flow so descendants such as choices stay on their own page. Allow 1 mm for paper size rounding. */
      .story-print-page { position: relative; box-sizing: border-box; width: 297mm; height: 209mm; break-inside: avoid; page-break-inside: avoid; break-after: page; page-break-after: always; }
      .story-print-page:last-child { break-after: auto; page-break-after: auto; }
      .story-print-viewport { position: absolute; top: 10mm; left: 10mm; width: 277mm; height: 183mm; }
      /* Lay out content at the paper width without applying zoom or blocking page breaks on nested flex and grid containers. */
      .story-print-content { --story-print-text-scale: 1; position: absolute; top: 0; left: 0; display: flow-root; width: 100%; margin: 0; }
      .story-print-copy, .story-print-step { display: block !important; flex: none !important; }
      /* Regular inline boxes preserve the two-column layout and avoid grid fragmentation during printing. */
      .story-print-options { display: block !important; font-size: 0; }
      .story-print-options > button { display: inline-block; box-sizing: border-box; width: calc((100% - 0.75rem) / 2); margin: 0 0 0.75rem; vertical-align: top; }
      .story-print-options > button:nth-child(odd) { margin-right: 0.75rem; }
      .story-print-page-number { position: absolute; right: 10mm; bottom: 5mm; font: 11px/1.4 sans-serif; color: #52525b; }
      .story-print-content button { min-width: 0; overflow-wrap: anywhere; font-size: calc(0.875rem * var(--story-print-text-scale)); }
      .story-print-content p { font-size: calc(1.125rem * var(--story-print-text-scale)); overflow-wrap: anywhere; }
      .story-print-content input { font-size: calc(1rem * var(--story-print-text-scale)); }
      .story-print-content h3 { font-size: calc(40px * var(--story-print-text-scale)) !important; line-height: 1.2; font-weight: 800 !important; overflow-wrap: anywhere; }
      .story-print-cover, .story-print-step-image { aspect-ratio: auto !important; }
      .story-print-cover img, .story-print-step-image img { position: static !important; width: 100% !important; height: 100% !important; object-fit: contain !important; }
      input { pointer-events: none; }
    `;
    printDocument.head.appendChild(style);
    const pages = source.cloneNode(true);
    // Copy the current input value explicitly when cloning nodes. Leave inputs on other steps blank.
    source.querySelectorAll('input').forEach((input, index) => {
      pages.querySelectorAll('input')[index].value = input.value;
    });
    pages.querySelectorAll('img').forEach((image) => {
      image.loading = 'eager';
      image.removeAttribute('srcset');
    });
    // Render page numbers independently of the scaled content and omit browser footers that include the time and URL.
    const storyPages = Array.from(pages.querySelectorAll('.story-print-page'));
    storyPages.forEach((page, index) => {
      const viewport = printDocument.createElement('div');
      viewport.className = 'story-print-viewport';
      viewport.appendChild(page.firstElementChild);
      const pageNumber = printDocument.createElement('div');
      pageNumber.className = 'story-print-page-number';
      pageNumber.textContent = `${index + 1} / ${storyPages.length}`;
      page.append(viewport, pageNumber);
    });
    printDocument.body.appendChild(pages);
    await Promise.race([
      (async () => {
        await Promise.all(stylesReady);
        await waitForPrintResources(printDocument);
      })(),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Print resources timed out')), 30000);
      }),
    ]);
    clearTimeout(timeout);
    // Images use the height remaining after text and choices. Always measure at the final paper size.
    storyPages.forEach((page, index) => {
      const viewport = page.querySelector('.story-print-viewport');
      const content = viewport.firstElementChild;
      const availableHeight = viewport.clientHeight - 2;
      const images = Array.from(content.querySelectorAll('.story-print-cover, .story-print-step-image'));
      images.forEach((image) => { image.style.display = 'none'; });
      const textHeight = Math.max(content.offsetHeight, content.scrollHeight);
      images.forEach((image) => { image.style.display = ''; });
      const imageBudget = Math.max(0, Math.min(availableHeight * 0.6, availableHeight - textHeight - 8));
      const preferredHeights = images.map((image) => {
        const picture = image.querySelector('img');
        const naturalHeight = picture ? image.clientWidth * picture.naturalHeight / picture.naturalWidth : image.clientWidth * 0.75;
        return image.classList.contains('story-print-step-image') ? Math.min(naturalHeight, 216) : naturalHeight;
      });
      const preferredTotal = preferredHeights.reduce((total, height) => total + height, 0);
      images.forEach((image, imageIndex) => {
        const minimumHeight = Math.min(96, preferredHeights[imageIndex]);
        image.style.height = `${Math.max(minimumHeight, preferredHeights[imageIndex] * Math.min(1, imageBudget / preferredTotal))}px`;
      });
      // Check all descendants, including long choices. For oversized text, adjust font size while preserving the page box model.
      const getContentHeight = () => {
        const top = content.getBoundingClientRect().top;
        return Math.max(content.offsetHeight, content.scrollHeight,
          ...Array.from(content.querySelectorAll('*'), (element) => element.getBoundingClientRect().bottom - top));
      };
      let textScale = 1;
      for (let attempt = 0; getContentHeight() > availableHeight && attempt < 12; attempt += 1) {
        textScale *= Math.min(0.9, availableHeight / getContentHeight());
        content.style.setProperty('--story-print-text-scale', String(textScale));
      }
      // Abort printing if the content cannot fit in full, so nothing is silently clipped.
      if (getContentHeight() > availableHeight || content.scrollWidth > viewport.clientWidth + 1) {
        throw new Error(`Story page ${index + 1} does not fit on A4`);
      }
    });
    await new Promise((resolve) => printWindow.requestAnimationFrame(() => printWindow.requestAnimationFrame(resolve)));
    // Some browsers name the PDF after the main document title. Keep that title until print preview closes.
    const originalTitle = document.title;
    document.title = printTitle;
    await new Promise((resolve, reject) => {
      restorePrintState = () => {
        if (document.title === printTitle) document.title = originalTitle;
        printWindow.removeEventListener('afterprint', handleAfterPrint);
        window.removeEventListener('afterprint', handleAfterPrint);
      };
      function handleAfterPrint() {
        restorePrintState();
        frame.remove();
        resolve();
      }
      printWindow.addEventListener('afterprint', handleAfterPrint, { once: true });
      window.addEventListener('afterprint', handleAfterPrint, { once: true });
      try {
        printWindow.focus();
        printWindow.print();
      } catch (error) {
        reject(error);
      }
    });
  } catch (error) {
    restorePrintState();
    frame.remove();
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
