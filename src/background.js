// Serialize queue edits from every tab against the latest persisted state.
let pending = Promise.resolve();

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== 'fp_queue_action') return;
    const operation = pending.then(async () => {
        const stored = await chrome.storage.local.get(['fp_queue', 'fp_queue_index']);
        const queue = stored.fp_queue || [];
        let currentIndex = stored.fp_queue_index ?? -1;
        const { action, video, id, targetId, setAsCurrent } = message;
        const index = queue.findIndex(item => item.id === id);
        if (action === 'add') {
            let addedIndex = queue.findIndex(item => item.id === video.id);
            if (addedIndex < 0) { queue.push(video); addedIndex = queue.length - 1; }
            if (setAsCurrent) currentIndex = addedIndex;
        } else if (action === 'remove' && index >= 0) {
            queue.splice(index, 1);
            if (currentIndex >= index) currentIndex--;
        } else if (action === 'clear') {
            queue.length = 0;
            currentIndex = -1;
        } else if (action === 'select' && index >= 0) {
            currentIndex = index;
        } else if (action === 'move' && index >= 0) {
            const targetIndex = queue.findIndex(item => item.id === targetId);
            if (targetIndex >= 0) {
                const currentId = queue[currentIndex]?.id;
                queue.splice(targetIndex, 0, queue.splice(index, 1)[0]);
                currentIndex = currentId ? queue.findIndex(item => item.id === currentId) : -1;
            }
        }
        await chrome.storage.local.set({ fp_queue: queue, fp_queue_index: currentIndex });
        return { queue, currentIndex };
    });
    pending = operation.catch(() => {});
    operation.then(respond, error => respond({ error: error.message }));
    return true;
});
