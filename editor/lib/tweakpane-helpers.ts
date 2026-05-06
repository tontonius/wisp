export function setFolderTitleEnabledState(folder: unknown, enabled: boolean): void {
  const element = (folder as { element?: HTMLElement }).element;
  if (!element) return;
  element.classList.toggle("folder-title-dimmed", !enabled);
  const titleRow = element.querySelector<HTMLElement>(".tp-fldv_t");
  if (titleRow) titleRow.style.opacity = enabled ? "1" : "0.5";
}
