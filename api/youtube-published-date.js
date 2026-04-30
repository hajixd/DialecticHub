const { fetchYouTubePublishedDate, getYouTubeVideoId } = require("../youtube-meta");

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Cache-Control", statusCode === 200 ? "public, max-age=3600, s-maxage=86400" : "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    sendJson(res, 405, { error: "METHOD_NOT_ALLOWED", publishedDate: "" });
    return;
  }

  const videoId = getYouTubeVideoId(req.query?.videoId || req.query?.url || "");
  if (!videoId) {
    sendJson(res, 400, { error: "INVALID_VIDEO_ID", publishedDate: "" });
    return;
  }

  try {
    const publishedDate = await fetchYouTubePublishedDate(videoId);
    if (!publishedDate) {
      sendJson(res, 404, { videoId, publishedDate: "" });
      return;
    }

    sendJson(res, 200, { videoId, publishedDate });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 0) === 400 ? 400 : 502;
    sendJson(res, statusCode, {
      error: statusCode === 400 ? "INVALID_VIDEO_ID" : "YOUTUBE_DATE_UNAVAILABLE",
      videoId,
      publishedDate: ""
    });
  }
};
