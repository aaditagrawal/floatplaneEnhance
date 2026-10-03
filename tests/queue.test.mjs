import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { runInNewContext } from 'node:vm';

function page() {
  const dom = new JSDOM('<div id="fp-queue-list"></div><video></video>', { url: 'https://www.floatplane.com/post/a', runScripts: 'outside-only' });
  const { window } = dom;
  const timers = [];
  Object.defineProperty(window.document, 'readyState', { value: 'loading' });
  const storage = { fp_queue: [{ id: 'a', title: 'A', url: '/post/a' }], fp_queue_index: 0 };
  let listener;
  const chrome = {
    storage: {
      local: { get: async () => structuredClone(storage), set: async values => Object.assign(storage, structuredClone(values)) },
      onChanged: { addListener() {} }
    },
    runtime: {
      onMessage: { addListener(callback) { listener = callback; } },
      sendMessage: message => new Promise(resolve => listener(message, {}, resolve))
    }
  };
  runInNewContext(readFileSync(new URL('../src/background.js', import.meta.url), 'utf8'), { chrome });
  window.chrome = chrome;
  window.setTimeout = (callback) => { timers.push(callback); return timers.length; };
  window.eval(readFileSync(new URL('../src/content.js', import.meta.url), 'utf8').split("if (document.readyState === 'loading')")[0] + '\nwindow.api = { STATE, removeFromQueue, renderQueue, loadQueue, getPostId, setupAutoplay };');
  window.api.STATE.contextValid = true;
  return { window, api: window.api, timers, storage, close: () => window.close() };
}

test('refresh at video end never schedules playback of the finished video', async () => {
  const p = page();
  p.api.setupAutoplay();
  p.window.document.querySelector('video').dispatchEvent(new p.window.Event('ended'));
  await Bun.sleep(0);
  expect(p.timers).toHaveLength(1); // Completion notification only.
  p.close();
});

test('removing the first playing row preserves the cursor before its successor', async () => {
  const p = page();
  p.api.STATE.queue = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  p.api.STATE.currentIndex = 0;
  p.storage.fp_queue = p.api.STATE.queue;
  await p.api.removeFromQueue(0);
  expect(p.api.STATE.currentIndex).toBe(-1);
  expect(p.api.STATE.queue[0].id).toBe('b');
  p.close();
});

test('queue metadata renders literally and foreign drag payloads leave the queue intact', () => {
  const p = page();
  p.api.STATE.queue = [{ id: 'a', title: '<b>literal</b>', thumbnail: "x'); color: red", url: '/post/a' }, { id: 'b' }];
  p.api.renderQueue();
  const item = p.window.document.querySelector('.fp-queue-item');
  expect(item.querySelector('.fp-queue-item-title').textContent).toContain('<b>literal</b>');
  expect(item.querySelector('b')).toBeNull();
  for (const payload of ['', 'NaN', '999']) {
    item.ondrop({ preventDefault() {}, dataTransfer: { getData: () => payload } });
    expect(p.api.STATE.queue.map(v => v.id)).toEqual(['a', 'b']);
  }
  p.close();
});

test('post identity ignores query strings, fragments, and a trailing slash', () => {
  const p = page();
  expect(p.api.getPostId('/post/a/?ref=x#play')).toBe('a');
  p.close();
});


test('independent stale tabs add without overwriting each other', async () => {
  const p = page();
  await Promise.all([
    p.window.chrome.runtime.sendMessage({ type: 'fp_queue_action', action: 'add', video: { id: 'b' } }),
    p.window.chrome.runtime.sendMessage({ type: 'fp_queue_action', action: 'add', video: { id: 'c' } })
  ]);
  expect(p.storage.fp_queue.map(video => video.id)).toEqual(['a', 'b', 'c']);
  p.close();
});
