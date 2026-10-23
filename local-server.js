const http = require("http");
const url = require("url");
const analyzeHandler = require("./api/analyze");
const patternsHandler = require("./api/patterns");

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Mock Vercel req / res helpers for plain Node HTTP server
  req.query = parsedUrl.query;
  
  res.status = function(code) {
    res.statusCode = code;
    return res;
  };
  
  res.json = function(data) {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data, null, 2));
  };

  // Root endpoint info
  if (pathname === "/" || pathname === "") {
    return res.json({
      status: "online",
      message: "WinGo Live Prediction API is running!",
      endpoints: {
        wingo_1min: "/api/analyze?type=1M",
        wingo_30sec: "/api/analyze?type=30S",
        patterns_catalog: "/api/patterns"
      }
    });
  }

  // Handle /api/analyze
  if (pathname === "/api/analyze") {
    return analyzeHandler(req, res);
  }

  // Handle /api/patterns
  if (pathname === "/api/patterns") {
    return patternsHandler(req, res);
  }

  // 404 Route
  return res.status(404).json({ error: "Endpoint Not found" });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
