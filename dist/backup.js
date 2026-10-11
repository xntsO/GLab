// All backup metadata stays beside the draft in this browser's local storage.
export const snapshot = (code, language) => ({code, language});
export const sameSnapshot = (a, b) => !!a && !!b && a.code === b.code && a.language === b.language;
export const validSnapshot = value => value && typeof value.code === 'string' && ['c', 'cpp'].includes(value.language);
export function needsBackup(value, original, retained) {
  return !sameSnapshot(value, original) && !sameSnapshot(value, retained);
}
export async function copySource(code) {
  if (navigator.clipboard?.writeText) {
    try {await navigator.clipboard.writeText(code); return true;} catch {}
  }
  const field = document.createElement('textarea');
  field.value = code; field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;left:-10000px;top:0;';
  document.body.append(field);
  const focused = document.activeElement;
  field.select();
  let copied = false;
  try {copied = document.execCommand('copy') === true;} catch {}
  field.remove(); focused?.focus();
  return copied;
}
