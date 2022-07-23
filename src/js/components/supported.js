const supported = [
	{
		ext: ["m3u8"],
		ct: [
			"application/x-mpegurl",
			"application/vnd.apple.mpegurl",
			"audio/vnd.apple.mpegurl"
		],
		type: "HLS",
		category: "stream"
	},
	{
		ext: ["mpd", "json?base64_init=1"],
		ct: ["application/dash+xml"],
		type: "DASH",
		category: "stream"
	},
	{ ext: ["f4m"], ct: ["application/f4m"], type: "HDS", category: "stream" },
	{ ext: ["ism/manifest"], ct: [], type: "MSS", category: "stream" },
	{ ext: ["vtt"], ct: ["text/vtt"], type: "VTT", category: "subtitles" },
	{
		ext: ["srt"],
		ct: ["application/x-subrip"],
		type: "SRT",
		category: "subtitles"
	},
	{
		ext: ["ttml", "ttml2"],
		ct: ["application/ttml+xml"],
		type: "TTML",
		category: "subtitles"
	},
	{
		ext: ["dfxp"],
		ct: ["application/ttaf+xml"],
		type: "DFXP",
		category: "subtitles"
	},
	{
		ext: ["mp4", "m4v", "m4s"],
		ct: ["video/x-m4v", "video/m4v", "video/mp4"],
		type: "MP4",
		category: "files"
	},
	{ ext: ["ts", "m2t"], ct: ["video/mp2t"], type: "TS", category: "files" },
	{
		ext: ["aac", "m4a"],
		ct: ["audio/aac", "audio/m4a"],
		type: "AAC",
		category: "files"
	},
	{ ext: ["mp3"], ct: ["audio/mpeg"], type: "MP3", category: "files" },
	{
		ext: ["ogg", "ogv", "oga", "opus"],
		ct: ["video/ogg", "audio/ogg", "audio/opus"],
		type: "OGG",
		category: "files"
	},
	{
		ext: ["weba", "webm"],
		ct: ["audio/webm", "video/webm"],
		type: "WEBM",
		category: "files"
	}
];

export default supported;
