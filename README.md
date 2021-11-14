## The Stream Detector

### What is this?

This is a Firefox addon written in JavaScript which provides an easy way to keep track of URLs to playlists and subtitles used by Apple HLS, Adobe HDS, MPEG-DASH, and Microsoft Smooth Streaming streams.

Also assembles readymade youtube-dl/FFmpeg/Streamlink/hlsdl/N_m3u8DL-CLI commands which (should) include all of the necessary cookies and headers.

![A screenshot of the options menu.](https://addons.cdn.mozilla.net/user-media/previews/full/239/239286.png)

More details and screenshots available [in the AMO listing](https://addons.mozilla.org/en-US/firefox/addon/hls-stream-detector/).

### What is this written in?

- Javascript,
- WebExtensions API, including:
  - Notifications,
  - Clipboard,
  - Storage,
  - Tabs.

### What's the point?

Being able to easily find direct URLs to streams on the Internet. I wrote this initially for my own use - I was fed up with hunting for URLs in the Network Monitor and manually adding all the necessary headers and cookies.

### Is anyone even using this?

As of updating this document, the addon has almost 10,000 average daily users.

### How do I use this?

Upon being notified that a stream has been detected (as in the screenshot above), click the toolbar button, and then click on the appropriate filename to copy the URL in its desired form. Use the addon's options page to customize your experience.

### Where can I download this?

- [The Firefox Addons (AMO) listing.](https://addons.mozilla.org/en-US/firefox/addon/hls-stream-detector/)
- [The GitHub releases page.](https://github.com/rowrawer/stream-detector/releases)

---

### Additional notes

- Currently broken in private browsing mode in Firefox. Version 2.8.3 works fine. Will be fixed eventually.
- The Chrome version of this addon is not maintained or supported in any way. It's only included on the off chance that it works. Don't expect it to.
- Websites such as YouTube, Vimeo, Facebook, etc. are very likely to use proprietary technologies which are not supported by this addon. When it comes to such "mainstream" services, it's better to use the tools (e.g. youtube-dl) directly.
- This should go without saying, but I am not responsible for and do not condone this addon being used for any nefarious purposes. Copyrighted content is probably DRM-ed anyway.
