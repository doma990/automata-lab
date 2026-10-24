export const $ = selector => document.querySelector(selector);
export function element(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (value !== false && value !== undefined && value !== null) node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [children].flat()) if (child !== null && child !== undefined) node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  return node;
}
export function option(value, label = value, selected = false) {
  const node = element('option', {value, text: label});
  node.selected = selected;
  return node;
}
export const displayWord = text => text === '' ? '""' : text;
export function chips(values, {empty = '∅', onUse} = {}) {
  if (!values.length) return element('span', {class: 'empty-set', text: empty});
  return element('div', {class: 'chips'}, values.map(value => onUse
    ? element('button', {type: 'button', class: 'chip chip-button', text: displayWord(value), title: 'Test this string', onclick: () => onUse(value)})
    : element('span', {class: 'chip', text: value})));
}
export function download(name, content, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], {type}));
  const link = element('a', {href: url, download: name});
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function notify(message, error = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('error', error);
  toast.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { toast.hidden = true; }, error ? 7000 : 3500);
}
export async function busy(button, action) {
  if (button.disabled) return;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  try { return await action(); }
  catch (error) { notify(error.message, true); }
  finally { button.disabled = false; button.removeAttribute('aria-busy'); }
}
