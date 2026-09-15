/** Versioned, opt-in resource receiver. Runs in the image consumer's origin.
 * No editor storage, credentials, fetches, or ambient path lookup. */
export const LOCAL_IMAGE_PROTOCOL = 1;
export const MAX_LOCAL_IMAGE_BYTES = 5 * 1024 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function receiveLocalImage(options) { return receiveLocalResource({...options, types: TYPES}); }
export async function receiveLocalResource({ resourceId, generation, timeoutMs = 15000, types = TYPES }) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(resourceId || '') ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(generation || '') || parent === window) {
    throw new Error('Invalid local image assignment. Reopen the story preview.');
  }
  return new Promise((resolve, reject) => {
    let receiving = false;
    const cleanup = () => { clearTimeout(timer); removeEventListener('message', receive); };
    const timer = setTimeout(() => {
      cleanup(); reject(new Error('This viewer could not receive its local image. Update the viewer runtime and reopen the preview.'));
    }, timeoutMs);
    async function receive(event) {
      const data = event.data;
      if (event.source !== parent || data?.kind !== 'sk-local-image' ||
          data.version !== LOCAL_IMAGE_PROTOCOL || data.resourceId !== resourceId ||
          data.generation !== generation || receiving) return;
      if (!(data.bytes instanceof ArrayBuffer)  ||
          data.bytes.byteLength > MAX_LOCAL_IMAGE_BYTES || !types.has(data.mime) ||
          !/^[a-f0-9]{64}$/.test(data.contentHash || '')) return;
      receiving = true;
      try {
        const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data.bytes))]
          .map(b => b.toString(16).padStart(2, '0')).join('');
        if (digest !== data.contentHash) throw new Error('Local image integrity check failed.');
        cleanup();
        const url = URL.createObjectURL(new Blob([data.bytes], { type: data.mime }));
        const revoke = () => URL.revokeObjectURL(url);
        addEventListener('pagehide', revoke, { once: true });
        resolve({ url, revoke, bytes: data.bytes, mime: data.mime });
      } catch (error) { cleanup(); reject(error); }
    }
    addEventListener('message', receive);
    parent.postMessage({ kind: 'sk-local-image-ready', version: LOCAL_IMAGE_PROTOCOL, resourceId, generation }, '*');
  });
}
