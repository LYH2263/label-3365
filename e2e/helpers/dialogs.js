export function setupDialogQueue(page, queue) {
  const listener = async (dialog) => {
    const next = queue.shift();
    if (!next || next.action === 'dismiss') {
      await dialog.dismiss();
      return;
    }
    await dialog.accept(next.value ?? '');
  };
  page.on('dialog', listener);
  return () => {
    page.off('dialog', listener);
  };
}
