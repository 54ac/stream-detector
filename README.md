## The Stream Detector

### What is this?

This is a Firefox addon written in JavaScript which provides an easy way to keep track of URLs to playlists and subtitles used by Apple HLS, Adobe HDS, MPEG-DASH, and Microsoft Smooth Streaming streams as well as download video/audio files directly and monitor any other file extensions and Content-Type headers.

Also assembles readymade yt-dlp/FFmpeg/Streamlink/hlsdl/N_m3u8DL-RE commands which (should) include all of the necessary cookies and headers.

![A screenshot of the options menu.](https://addons.mozilla.org/user-media/previews/full/274/274526.png)

More details and screenshots available [in the AMO listing](https://addons.mozilla.org/en-US/firefox/addon/hls-stream-detector/).

### What is this written in?

- Javascript,
- WebExtensions API, including:
  - Clipboard,
  - Downloads,
  - Notifications,
  - Storage,
  - Tabs.

### What's the point?

Being able to easily find direct URLs to streams on the Internet. I wrote this initially for my own use - I was fed up with hunting for URLs in the Network Monitor and manually adding all the necessary headers and cookies.

### Is anyone even using this?

As of updating this document, the addon has over 10,000 average daily users and 2,500 downloads in the last 30 days.

### How do I use this?

Upon being notified that a stream has been detected (as in the screenshot above), click the toolbar button, and then click on the appropriate filename to copy the URL in its desired form. Use the addon's options page to customize your experience and e.g. download media files directly.

### Where can I download this?

- [The Firefox Addons (AMO) listing.](https://addons.mozilla.org/en-US/firefox/addon/hls-stream-detector/)
- [The GitHub releases page.](https://github.com/rowrawer/stream-detector/releases)

---

### Additional notes

- The Chrome version of this addon is not maintained or supported in any way. It's only included on the off chance that it works. Don't expect it to.
- Feel free to submit a translation by way of a pull request if the addon is not available in your preferred language.
- Websites such as YouTube, Vimeo, Facebook, etc. are very likely to use proprietary technologies which are not supported by this addon. When it comes to such "mainstream" services, it's better to use the tools (e.g. yt-dlp) directly.
- This should go without saying, but I am not responsible for and do not condone this addon being used for any nefarious purposes. Copyrighted content is probably DRM-ed anyway.
