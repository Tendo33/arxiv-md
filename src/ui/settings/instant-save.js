// A3-3：设置即时保存。每个控件变化时只写它自己的那一项。
export const FIELDS = [
  { sel: 'input[name="conversionMode"]', read: (el) => el.value, save: (s, v) => s.setConversionMode(v), only: (el) => el.checked },
  { sel: '#showNotifications', read: (el) => el.checked, save: (s, v) => s.setShowNotifications(v) },
  { sel: '#autoConvert', read: (el) => el.checked, save: (s, v) => s.setAutoConvert(v) },
  { sel: '#includeMetadata', read: (el) => el.checked, save: (s, v) => s.setIncludeMetadata(v) },
  // Token：change 在失焦且内容有变时触发；清空即删除已保存的 Token
  { sel: '#mineruToken', read: (el) => el.value.trim(), save: (s, v) => s.setMinerUToken(v) },
];

export function bindInstantSave(doc, storage, { onSaved, onError } = {}) {
  for (const f of FIELDS) {
    doc.querySelectorAll(f.sel).forEach((el) => {
      el.addEventListener('change', async () => {
        if (f.only && !f.only(el)) return;
        try {
          await f.save(storage, f.read(el));
          if (onSaved) onSaved(el);
        } catch (error) {
          if (onError) onError(error, el);
        }
      });
    });
  }
}
