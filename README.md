# Floatplane Queue

A browser extension that adds video queueing functionality to Floatplane, allowing you to build and manage a watchlist with automatic playback.

## Features

- **Queue Management**: Add videos to your queue directly from video thumbnails with hover-to-reveal add buttons
- **Drag & Drop Reordering**: Organize your queue by dragging items to rearrange them
- **Automatic Playback**: Auto-plays the next video when the current one ends
- **Queue Navigation**: Navigate forward and backward through your queue with intuitive controls
- **Persistent Storage**: Your queue is saved and persists across browser sessions
- **Auto-Add Detection**: Automatically adds the currently watching video to your queue

## Installation

### Manual Installation

1. Download or clone this repository
2. Open Chrome/Edge and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top right)
4. Click "Load unpacked"
5. Select the directory containing this extension
6. The extension is now installed!

## Usage

### Adding Videos to Queue

1. Navigate to any Floatplane page with video thumbnails
2. Hover over a video thumbnail to reveal the add button (+)
3. Click the button to add the video to your queue

### Managing Your Queue

- **Open Queue**: Click the Queue button in the bottom right corner
- **Play Video**: Click any item in the queue to jump to that video
- **Reorder**: Drag and drop items to reorder them
- **Remove**: Click the × button on any item to remove it
- **Clear All**: Click "Clear" to empty the entire queue
- **Navigate**: Use ◀ and ▶ buttons to play previous/next videos

### Auto-Play

When a video finishes playing, the extension will automatically:
1. Show a notification with the next video's title
2. Wait 1.5 seconds
3. Navigate to the next video in your queue

## Development

### Project Structure

```
fp-queue/
├── manifest.json         
├── src/
│   ├── background.js       # Background service worker
│   ├── content.js          # Main content script
│   ├── styles.css          # UI styles
│   └── icons/              
└── README.md              
```

### Installation

Simply load the unpacked extension in Chrome/Edge for development.

### Permissions

- `storage`: Required for persisting queue data across sessions
- `*://*.floatplane.com/*`: Required to run on Floatplane pages

## License

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

## Support

For issues or questions, please open an issue on the repository.
