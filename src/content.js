// Floatplane Queue Extension Content Script

const STATE = {
    queue: [], // Array of { id, title, url, thumbnail, duration }
    currentIndex: -1, // Index of currently playing video (-1 if none)
    isOpen: false
};

// --- Storage ---
const loadQueue = async () => {
    try {
        const result = await chrome.storage.local.get(['fp_queue', 'fp_queue_index']);
        STATE.queue = result.fp_queue || [];
        STATE.currentIndex = result.fp_queue_index ?? -1;
        updateContainerVisibility();
        renderQueue();
        checkAutoAdd();
        tryAutoPlayVideo(); // Try to auto-play if we just navigated
    } catch (e) {
        STATE.contextValid = false;
        // Silent - extension was reloaded, user should refresh
    }
};

const saveQueue = async () => {
    try {
        await chrome.storage.local.set({
            'fp_queue': STATE.queue,
            'fp_queue_index': STATE.currentIndex
        });
        updateContainerVisibility();
        renderQueue();
    } catch (e) {
        STATE.contextValid = false;
        // Silent - extension was reloaded, user should refresh
    }
};

const updateContainerVisibility = () => {
    const container = document.getElementById('fp-queue-container');
    if (container) {
        if (STATE.queue.length === 0) {
            container.style.display = 'none';
            STATE.isOpen = false;
            container.classList.add('fp-queue-collapsed');
        } else {
            container.style.display = 'flex';
        }
    }
};

const addToQueue = (video, options = { silent: false, setAsCurrent: false }) => {
    const existingIndex = STATE.queue.findIndex(v => v.id === video.id);

    if (existingIndex !== -1) {
        if (options.setAsCurrent) {
            STATE.currentIndex = existingIndex;
            saveQueue();
            if (!options.silent) showNotification(`Now Playing: ${video.title}`);
        } else {
            if (!options.silent) showNotification('Already in Queue');
        }
    } else {
        STATE.queue.push(video);
        if (options.setAsCurrent) {
            STATE.currentIndex = STATE.queue.length - 1;
        }
        saveQueue();
        updateContainerVisibility();
        if (!options.silent) showNotification(`Added to Queue: ${video.title}`);
    }
};

const removeFromQueue = (index) => {
    STATE.queue.splice(index, 1);
    // Adjust currentIndex if needed
    if (STATE.currentIndex >= index && STATE.currentIndex > 0) {
        STATE.currentIndex--;
    }
    if (STATE.currentIndex >= STATE.queue.length) {
        STATE.currentIndex = STATE.queue.length - 1;
    }
    saveQueue();
};

const clearQueue = () => {
    STATE.queue = [];
    STATE.currentIndex = -1;
    saveQueue();
};

// --- UI Components ---

const showNotification = (msg) => {
    let notif = document.getElementById('fp-queue-notification');
    if (!notif) {
        notif = document.createElement('div');
        notif.id = 'fp-queue-notification';
        document.body.appendChild(notif);
    }
    notif.textContent = msg;
    notif.classList.add('show');
    setTimeout(() => {
        notif.classList.remove('show');
    }, 3000);
};

const createQueuePanel = () => {
    if (document.getElementById('fp-queue-container')) return;

    const container = document.createElement('div');
    container.id = 'fp-queue-container';
    container.className = 'fp-queue-glass fp-queue-collapsed';
    container.style.display = 'none';

    const toggleBtn = document.createElement('div');
    toggleBtn.id = 'fp-queue-toggle';
    toggleBtn.innerHTML = `
    <div class="fp-queue-toggle-left">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
        </svg>
        <span>Queue</span>
    </div>
    <span id="fp-queue-count" class="fp-queue-badge">0/0</span>
  `;
    toggleBtn.onclick = () => {
        container.classList.toggle('fp-queue-collapsed');
        STATE.isOpen = !container.classList.contains('fp-queue-collapsed');
    };

    const content = document.createElement('div');
    content.id = 'fp-queue-content';

    const header = document.createElement('div');
    header.className = 'fp-queue-header';
    header.innerHTML = '<h3>Up Next</h3>';

    // Prev/Next buttons in header
    const navBtns = document.createElement('div');
    navBtns.className = 'fp-queue-nav-btns';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'fp-queue-nav-btn';
    prevBtn.innerHTML = '◀';
    prevBtn.title = 'Previous';
    prevBtn.onclick = playPrevious;

    const nextBtn = document.createElement('button');
    nextBtn.className = 'fp-queue-nav-btn';
    nextBtn.innerHTML = '▶';
    nextBtn.title = 'Next';
    nextBtn.onclick = playNext;

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.className = 'fp-queue-text-btn';
    clearBtn.onclick = clearQueue;

    navBtns.appendChild(prevBtn);
    navBtns.appendChild(nextBtn);
    navBtns.appendChild(clearBtn);
    header.appendChild(navBtns);

    const list = document.createElement('div');
    list.id = 'fp-queue-list';

    content.appendChild(header);
    content.appendChild(list);
    container.appendChild(toggleBtn);
    container.appendChild(content);

    document.body.appendChild(container);
};

const renderQueue = () => {
    const countEl = document.getElementById('fp-queue-count');
    const total = STATE.queue.length;
    const currentPos = STATE.currentIndex >= 0 ? STATE.currentIndex + 1 : '-';
    if (countEl) countEl.textContent = `${currentPos}/${total}`;

    const list = document.getElementById('fp-queue-list');
    if (!list) return;

    list.innerHTML = '';
    STATE.queue.forEach((video, index) => {
        const isCurrent = index === STATE.currentIndex;
        const item = document.createElement('div');
        item.className = `fp-queue-item ${isCurrent ? 'current' : ''}`;
        item.draggable = true;

        item.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', index);
            e.dataTransfer.effectAllowed = 'move';
            item.classList.add('dragging');
        };
        item.ondragend = () => {
            item.classList.remove('dragging');
        };
        item.ondragover = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        };
        item.ondrop = (e) => {
            e.preventDefault();
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const toIndex = index;
            if (fromIndex !== toIndex) {
                const movedItem = STATE.queue.splice(fromIndex, 1)[0];
                STATE.queue.splice(toIndex, 0, movedItem);
                // Update currentIndex if affected
                if (STATE.currentIndex === fromIndex) {
                    STATE.currentIndex = toIndex;
                } else if (fromIndex < STATE.currentIndex && toIndex >= STATE.currentIndex) {
                    STATE.currentIndex--;
                } else if (fromIndex > STATE.currentIndex && toIndex <= STATE.currentIndex) {
                    STATE.currentIndex++;
                }
                saveQueue();
            }
        };

        const rank = index + 1;
        const durationText = video.duration || '';
        const titleText = video.title || 'Unknown Video';
        const subchannelText = video.subchannel || '';

        // Build meta line: "Subchannel • Duration" or just one if other missing
        let metaParts = [];
        if (subchannelText) metaParts.push(subchannelText);
        if (durationText) metaParts.push(durationText);
        const metaLine = metaParts.join(' • ');

        item.innerHTML = `
      <div class="fp-queue-item-thumb" style="background-image: url('${video.thumbnail}')">
        ${isCurrent ? '<div class="fp-queue-playing-indicator">▶</div>' : ''}
      </div>
      <div class="fp-queue-item-info">
        <div class="fp-queue-item-title"><span class="fp-queue-rank">${rank}.</span> ${titleText}</div>
        <div class="fp-queue-item-meta">${metaLine}</div>
      </div>
      <div class="fp-queue-actions">
        <button class="fp-queue-remove" title="Remove">×</button>
      </div>
    `;

        item.onclick = (e) => {
            if (e.target.closest('.fp-queue-remove')) return;
            // Set as current and navigate
            STATE.currentIndex = index;
            saveQueue();
            window.location.href = video.url;
        };

        item.querySelector('.fp-queue-remove').onclick = (e) => {
            e.stopPropagation();
            removeFromQueue(index);
        };

        list.appendChild(item);
    });
};

// --- Auto-Add Feature ---
const checkAutoAdd = () => {
    if (STATE.queue.length === 0) return;

    const path = window.location.pathname;
    if (!path.startsWith('/post/')) return;

    const id = path.split('/post/')[1];

    // Find if already in queue
    const existingIdx = STATE.queue.findIndex(v => v.id === id);
    if (existingIdx !== -1) {
        // Just update currentIndex to this item
        if (STATE.currentIndex !== existingIdx) {
            STATE.currentIndex = existingIdx;
            saveQueue();
        }
        return;
    }

    // Not in queue. Extract info from PAGE and add as current.
    const attemptAdd = (retries = 3) => {
        const titleEl = document.querySelector('h1') || document.title;
        const title = typeof titleEl === 'string' ? titleEl : titleEl.innerText;

        let thumbnail = '';
        const metaImg = document.querySelector('meta[property="og:image"]');
        if (metaImg) thumbnail = metaImg.content;

        if (!title || title.length === 0) {
            if (retries > 0) setTimeout(() => attemptAdd(retries - 1), 1000);
            return;
        }

        const video = {
            id,
            url: window.location.href,
            title: title.replace('Floatplane - ', '').trim(),
            thumbnail,
            duration: '' // Could try to extract from page
        };

        console.log('Auto-adding current video:', video);
        addToQueue(video, { silent: true, setAsCurrent: true });
    };

    attemptAdd();
};


// --- Injection Logic ---

const extractVideoInfo = (anchor, container) => {
    const url = anchor.href;
    const id = url.split('/post/')[1];

    let thumbnail = '';
    const img = container.querySelector('img');
    if (img) {
        thumbnail = img.src;
    } else {
        const allDivs = container.querySelectorAll('div');
        for (let div of allDivs) {
            if (div.style.backgroundImage && div.style.backgroundImage !== 'none') {
                thumbnail = div.style.backgroundImage.slice(5, -2);
                break;
            }
        }
    }

    let title = 'Unknown Video';
    // Look for a title link that's NOT the thumbnail link (doesn't contain an image)
    const allLinks = container.querySelectorAll(`a[href*="${id}"]`);
    for (const link of allLinks) {
        // Skip if this link contains an image (it's the thumbnail)
        if (link.querySelector('img') || link.querySelector('[style*="background-image"]')) continue;
        // Check if it has meaningful text (not just duration format or empty)
        const linkText = link.innerText.trim();
        if (linkText.length > 1 && !/^\d+:\d+$/.test(linkText) && !linkText.startsWith('Duration:')) {
            title = linkText;
            break;
        }
    }
    // Fallback: try parent container for title element
    if (title === 'Unknown Video') {
        const titleEl = container.querySelector('h1, h2, h3, h4, [class*="title"], [class*="Title"]');
        if (titleEl && titleEl.innerText.trim().length > 1) {
            const titleText = titleEl.innerText.trim();
            if (!/^\d+:\d+$/.test(titleText) && !titleText.startsWith('Duration:')) {
                title = titleText;
            }
        }
    }

    // Try to find duration
    let duration = '';
    // Look for duration in multiple places
    const durationEl = container.querySelector('[class*="duration"]') ||
        container.querySelector('[class*="Duration"]') ||
        anchor.querySelector('[class*="duration"]') ||
        anchor.querySelector('[class*="Duration"]');

    if (durationEl) {
        const text = durationEl.innerText.trim();
        // Match pure duration format "12:34" or "1:23:45"
        if (/^\d+:\d+(:\d+)?$/.test(text)) {
            duration = text;
        }
        // Match "Duration: 12:34" format and extract just the time
        else if (/Duration:\s*(\d+:\d+(:\d+)?)/.test(text)) {
            const match = text.match(/Duration:\s*(\d+:\d+(:\d+)?)/);
            if (match) duration = match[1];
        }
    }

    // Try to find subchannel name
    let subchannel = '';
    const subchannelEl = container.querySelector('a[class*="channelName"]') ||
        container.querySelector('[class*="channelName"]');
    if (subchannelEl) {
        subchannel = subchannelEl.innerText.trim();
    }

    return { id, url, title, thumbnail, duration, subchannel };
};

const processVideoLinks = () => {
    // Only target anchor links that contain an image (thumbnail links)
    const links = document.querySelectorAll('a[href^="/post/"]');
    const processedIds = new Set();

    links.forEach(anchor => {
        // Extract video ID
        const videoId = anchor.href.split('/post/')[1];
        if (!videoId || processedIds.has(videoId)) return;

        // Check if this anchor contains an image (it's a thumbnail link)
        const hasImage = anchor.querySelector('img') ||
            anchor.querySelector('[style*="background-image"]');

        if (!hasImage) {
            // This is a text/title link, not a thumbnail - skip
            return;
        }

        // Mark this video as processed
        processedIds.add(videoId);

        // Find the visual container (the anchor itself or its parent with the image)
        let container = anchor;

        // If the anchor doesn't have relative positioning, use its parent
        if (window.getComputedStyle(anchor).position === 'static') {
            container = anchor.closest('div') || anchor;
        }

        if (container.dataset.fpQueueProcessed) return;

        container.dataset.fpQueueProcessed = 'true';
        container.style.position = 'relative';

        const btn = document.createElement('div');
        btn.className = 'fp-queue-add-btn';
        btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    `;
        btn.title = 'Add to Queue';
        btn.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            // Find the full tile container for extracting info
            const tileContainer = anchor.closest('div[class*="Tile"]') || anchor.closest('div');
            const video = extractVideoInfo(anchor, tileContainer);

            console.log("Adding video:", video);
            addToQueue(video);

            btn.classList.add('added');
            setTimeout(() => btn.classList.remove('added'), 1000);
            return false;
        };

        container.appendChild(btn);
    });
};


const startObserver = () => {
    let timeout;
    const observer = new MutationObserver((mutations) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(processVideoLinks, 500);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    processVideoLinks();
};

// --- Navigation ---
const playNext = () => {
    if (STATE.queue.length === 0) {
        showNotification('Queue is empty');
        return;
    }

    const nextIndex = STATE.currentIndex + 1;
    if (nextIndex < STATE.queue.length) {
        STATE.currentIndex = nextIndex;
        saveQueue();
        window.location.href = STATE.queue[nextIndex].url;
    } else {
        showNotification('End of queue');
    }
};

const playPrevious = () => {
    if (STATE.queue.length === 0) {
        showNotification('Queue is empty');
        return;
    }

    const prevIndex = STATE.currentIndex - 1;
    if (prevIndex >= 0) {
        STATE.currentIndex = prevIndex;
        saveQueue();
        window.location.href = STATE.queue[prevIndex].url;
    } else {
        showNotification('Beginning of queue');
    }
};

// --- Autoplay Logic ---
const setupAutoplay = () => {
    if (!STATE.contextValid) return;

    const video = document.querySelector('video');
    if (!video || video.dataset.fpQueueAutoplay) return;

    video.dataset.fpQueueAutoplay = 'true';

    video.addEventListener('ended', () => {
        if (!STATE.contextValid) return;
        console.log("Video ended.");
        loadQueue().then(() => {
            const nextIndex = STATE.currentIndex + 1;
            if (nextIndex < STATE.queue.length) {
                const nextVideo = STATE.queue[nextIndex];
                console.log("Autoplaying next:", nextVideo.title);
                showNotification(`Up Next: ${nextVideo.title}`);
                setTimeout(() => {
                    STATE.currentIndex = nextIndex;
                    saveQueue();
                    window.location.href = nextVideo.url;
                }, 1500);
            } else {
                showNotification('Queue complete!');
            }
        });
    });
};

// init
let autoplayInterval;
const init = () => {
    STATE.contextValid = true;
    createQueuePanel();
    loadQueue();
    startObserver();
    // Check for video periodically to attach autoplay listener
    autoplayInterval = setInterval(() => {
        if (!STATE.contextValid) {
            clearInterval(autoplayInterval);
            return;
        }
        setupAutoplay();
    }, 2000);
};

// --- Auto-Play Video on Page Load ---
const tryAutoPlayVideo = () => {
    if (!STATE.contextValid) return;
    // If we're on a video page and have a queue, try to auto-play
    const path = window.location.pathname;
    if (!path.startsWith('/post/')) return;
    if (STATE.queue.length === 0) return;

    const attemptPlay = (retries = 10) => {
        if (!STATE.contextValid) return;
        const video = document.querySelector('video');
        if (video) {
            // Try to play the video
            video.play().then(() => {
                console.log('FP Queue: Auto-play triggered successfully');
            }).catch(err => {
                // Autoplay blocked - try clicking the play button
                console.log('FP Queue: Autoplay blocked, trying play button...', err);
                const playBtn = document.querySelector('[class*="play"]') ||
                    document.querySelector('button[aria-label*="play"]') ||
                    document.querySelector('.vjs-big-play-button') ||
                    document.querySelector('[class*="PlayButton"]');
                if (playBtn) {
                    playBtn.click();
                }
            });
        } else if (retries > 0) {
            setTimeout(() => attemptPlay(retries - 1), 500);
        }
    };

    // Delay slightly to let page load
    setTimeout(() => attemptPlay(), 1000);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

