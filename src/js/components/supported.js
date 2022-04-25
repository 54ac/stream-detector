const supported = [
	{
		ext: ["m3u8"],
		ct: ["application/x-mpegurl", "application/vnd.apple.mpegurl"],
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
	{ ext: ["m4a"], ct: ["audio/m4a"], type: "M4A", category: "files" },
	{ ext: ["ts"], ct: ["video/mp2t"], type: "TS", category: "files" },
	{ ext: ["aac"], ct: ["audio/aac"], type: "AAC", category: "files" },
	{ ext: ["mp3"], ct: ["audio/mpeg"], type: "MP3", category: "files" },
	{ ext: ["opus"], ct: ["audio/opus"], type: "OPUS", category: "files" },
	{ ext: ["weba"], ct: ["audio/webm"], type: "WEBM", category: "files" },
	{ ext: ["webm"], ct: ["video/webm"], type: "WEBM", category: "files" }
];

export default supported;
