## The Stream Detector

### What is this?

This is a Firefox addon written in JavaScript which provides an easy way to keep track of URLs to playlists and subtitles used by Apple HLS, Adobe HDS, MPEG-DASH, and Microsoft Smooth Streaming streams.

Also assembles readymade youtube-dl (recommended)/FFmpeg/Streamlink/hlsdl commands which (should) include all of the necessary cookies and headers.

![A screenshot of a notification.](https://addons.cdn.mozilla.net/user-media/previews/thumbs/204/204893.png?modified=1543520749)

More details and screenshots available [in the AMO listing](https://addons.mozilla.org/en-US/firefox/addon/hls-stream-detector/).

### What is this written in?

- Javascript,
- WebExtensions API, including:
  _ Notifications,
  _ Clipboard,
  _ Storage,
  _ Tabs.

### What's the point?

Being able to easily find direct URLs to streams on the Internet. I wrote this initially for my own use - I was fed up with hunting for URLs in the Network Monitor and manually adding all the necessary headers and cookies.

### Is anyone even using this?

As of updating this document, the addon has been downloaded over 2,700 times within the last month and has over 7,300 average daily users.

### How do I use this?

Upon being notified that a stream has been detected (as in the screenshot above), click the toolbar button, and then click on the appropriate filename to copy the URL in its desired form. Use the addon's options page to customize your experience.

### Where can I download this?

- [The Firefox Addons (AMO) listing.](https://addons.mozilla.org/en-US/firefox/addon/hls-stream-detector/)
- [The GitHub releases page.](https://github.com/rowrawer/stream-detector/releases)

---

### Future plans and things to do

- [x] ~~Clean up the URL detection routine~~,
- [x] ~~Rethink the UX~~,
- [x] ~~Implement per-tab lists~~,
- [ ] Sort detected URLs by video/audio quality? This would require downloading and parsing every detected manifest. Might not be feasible,
- [ ] Search through the HTML for URLs?

### Additional notes

- Websites such as YouTube, Vimeo, Facebook, etc. are very likely to use proprietary technologies which are not supported by this addon. When it comes to such "mainstream" services, it's better to use the tools (e.g. youtube-dl) directly.
- This should go without saying, but I am not responsible for and do not condone this addon being used for any nefarious purposes. Copyrighted content is probably DRM-ed anyway.
