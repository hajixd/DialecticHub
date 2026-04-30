const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{6,}$/;

function normalizeDateText(value) {
  const match = String(value || "").match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function getYouTubeVideoId(rawValue) {
  const safeValue = String(rawValue || "").trim();
  if (!safeValue) return "";
  if (YOUTUBE_VIDEO_ID_PATTERN.test(safeValue)) return safeValue;

  try {
    const url = new URL(safeValue);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const shortId = url.pathname.split("/").filter(Boolean)[0] || "";
      return YOUTUBE_VIDEO_ID_PATTERN.test(shortId) ? shortId : "";
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      let videoId = "";

      if (url.pathname === "/watch") {
        videoId = url.searchParams.get("v") || "";
      } else if (
        url.pathname.startsWith("/embed/") ||
        url.pathname.startsWith("/shorts/") ||
        url.pathname.startsWith("/live/")
      ) {
        videoId = url.pathname.split("/").filter(Boolean)[1] || "";
      }

      return YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : "";
    }
  } catch (_) {
    return "";
  }

  return "";
}

function extractYouTubePublishedDate(html) {
  const page = String(html || "");
  const patterns = [
    /"publishDate"\s*:\s*"([^"]+)"/i,
    /"uploadDate"\s*:\s*"([^"]+)"/i,
    /"datePublished"\s*:\s*"([^"]+)"/i,
    /<meta[^>]+itemprop=["']datePublished["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+itemprop=["']uploadDate["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']datePublished["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']uploadDate["']/i
  ];

  for (const pattern of patterns) {
    const match = page.match(pattern);
    const dateText = normalizeDateText(match?.[1] || "");
    if (dateText) return dateText;
  }

  return "";
}

async function fetchYouTubePublishedDate(videoId) {
  const safeVideoId = getYouTubeVideoId(videoId);
  if (!safeVideoId) {
    const error = new Error("INVALID_VIDEO_ID");
    error.statusCode = 400;
    throw error;
  }

  const response = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(safeVideoId)}&hl=en`, {
    headers: {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    }
  });

  if (!response.ok) {
    const error = new Error(`YOUTUBE_FETCH_${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  return extractYouTubePublishedDate(await response.text());
}

module.exports = {
  extractYouTubePublishedDate,
  fetchYouTubePublishedDate,
  getYouTubeVideoId,
  normalizeDateText
};
