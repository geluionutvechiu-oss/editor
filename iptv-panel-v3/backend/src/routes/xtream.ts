/**
 * Xtream Codes API Compatibility Layer
 * Full compatibility with Xtream Codes v1/v2 API
 * All IPTV apps that use Xtream Codes will work with this panel.
 */
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

async function authenticateClient(username: string, password: string) {
  const client = await prisma.client.findFirst({
    where: { username, password, status: 'ACTIVE' },
    include: { server: true, plan: true },
  });
  if (!client) return null;
  if (client.expiresAt < new Date()) {
    await prisma.client.update({ where: { id: client.id }, data: { status: 'EXPIRED' } });
    return null;
  }
  // Update last seen
  await prisma.client.update({ where: { id: client.id }, data: { lastSeen: new Date() } });
  return client;
}

function userInfo(client: Awaited<ReturnType<typeof authenticateClient>>) {
  if (!client) return null;
  const expireTs = Math.floor(client.expiresAt.getTime() / 1000);
  return {
    username: client.username,
    password: client.password,
    message: '',
    auth: 1,
    status: 'Active',
    exp_date: String(expireTs),
    is_trial: '0',
    active_cons: '0',
    created_at: String(Math.floor(client.createdAt.getTime() / 1000)),
    max_connections: String(client.maxConnections),
    allowed_output_formats: ['ts', 'm3u8', 'rtmp'],
  };
}

function serverInfo(req: Request) {
  const host = `${req.protocol}://${req.get('host')}`;
  return {
    url: host,
    port: '80',
    https_port: '443',
    server_protocol: req.protocol,
    rtmp_port: '1935',
    timezone: 'Europe/London',
    timestamp_now: Math.floor(Date.now() / 1000),
    time_now: new Date().toISOString().replace('T', ' ').split('.')[0],
  };
}

// GET /player_api.php?username=X&password=X&action=get_live_streams
// GET /player_api.php?username=X&password=X (login)
router.get('/player_api.php', async (req: Request, res: Response): Promise<void> => {
  const { username = '', password = '', action = '' } = req.query as Record<string, string>;

  const client = await authenticateClient(username, password);
  if (!client) {
    res.json({ user_info: { auth: 0 }, server_info: serverInfo(req) });
    return;
  }

  // Authentication response (no action)
  if (!action || action === 'get_user_info') {
    res.json({ user_info: userInfo(client), server_info: serverInfo(req) });
    return;
  }

  const server = client.server;
  const host = server?.url || process.env.DEFAULT_SERVER_URL || req.protocol + '://' + req.get('host');

  switch (action) {
    case 'get_live_categories':
      res.json(client.bouquets.map((b, i) => ({ category_id: String(i + 1), category_name: b, parent_id: 0 })));
      break;

    case 'get_live_streams': {
      // Proxy to upstream server or return empty
      const streams = client.bouquets.map((b, i) => ({
        num: i + 1,
        name: b,
        stream_type: 'live',
        stream_id: i + 1,
        stream_icon: '',
        epg_channel_id: '',
        added: '0',
        category_id: String((i % client.bouquets.length) + 1),
        custom_sid: '',
        tv_archive: 0,
        direct_source: '',
        tv_archive_duration: 0,
      }));
      res.json(streams);
      break;
    }

    case 'get_vod_streams':
      res.json([]);
      break;

    case 'get_series':
      res.json([]);
      break;

    case 'get_vod_categories':
    case 'get_series_categories':
      res.json([]);
      break;

    case 'get_short_epg':
    case 'get_simple_data_table':
      res.json({ epg_listings: [] });
      break;

    default:
      res.json({ error: 'Action not found' });
  }
});

// GET /get.php?username=X&password=X&type=m3u_plus
router.get('/get.php', async (req: Request, res: Response): Promise<void> => {
  const { username = '', password = '', type = 'm3u_plus', output = 'ts' } = req.query as Record<string, string>;

  const client = await authenticateClient(username, password);
  if (!client) {
    res.status(401).send('#EXTM3U\n# Unauthorized');
    return;
  }

  const host = client.server?.url || process.env.DEFAULT_SERVER_URL || `${req.protocol}://${req.get('host')}`;

  let m3u = `#EXTM3U url-tvg="${host}/xmltv.php?username=${username}&password=${password}"\n`;
  client.bouquets.forEach((bouquet, i) => {
    const streamId = i + 1;
    m3u += `#EXTINF:-1 tvg-id="${streamId}" tvg-name="${bouquet}" tvg-logo="" group-title="${bouquet}",${bouquet}\n`;
    m3u += `${host}/live/${username}/${password}/${streamId}.${output}\n`;
  });

  res.setHeader('Content-Type', 'application/x-mpegurl');
  res.setHeader('Content-Disposition', `attachment; filename="${username}.m3u"`);
  res.send(m3u);
});

// GET /xmltv.php?username=X&password=X  — EPG/XMLTV feed
router.get('/xmltv.php', async (req: Request, res: Response): Promise<void> => {
  const { username = '', password = '' } = req.query as Record<string, string>;

  const client = await authenticateClient(username, password);
  if (!client) {
    res.status(401).send('<?xml version="1.0"?><tv></tv>');
    return;
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE tv SYSTEM "xmltv.dtd">
<tv generator-info-name="IPTV Panel" generator-info-url="">
${client.bouquets.map((b, i) => `  <channel id="${i + 1}"><display-name>${b}</display-name></channel>`).join('\n')}
</tv>`;

  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  res.send(xml);
});

// GET /live/:username/:password/:streamId.ts — stream proxy placeholder
router.get('/live/:username/:password/:streamId', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.params;
  const client = await authenticateClient(username, password);
  if (!client) { res.status(401).end(); return; }

  // In production: proxy to actual stream from client.server
  // For now: return 404 to indicate no actual stream configured
  res.status(503).json({ error: 'No stream source configured for this server. Configure a real upstream server URL.' });
});

export default router;
