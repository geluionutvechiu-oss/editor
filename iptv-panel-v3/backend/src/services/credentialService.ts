import QRCode from 'qrcode';

export interface ClientCredentials {
  username: string;
  password: string;
  m3uUrl: string;
  xtreamHost: string;
}

export function generateM3UUrl(client: ClientCredentials): string {
  return `${client.xtreamHost}/get.php?username=${client.username}&password=${client.password}&type=m3u_plus&output=ts`;
}

export function generateXtreamCredentials(client: ClientCredentials) {
  return {
    host: client.xtreamHost,
    username: client.username,
    password: client.password,
  };
}

export async function generateQRCode(text: string): Promise<string> {
  return QRCode.toDataURL(text);
}

export async function generateAllFormats(client: ClientCredentials) {
  const m3uUrl = client.m3uUrl || generateM3UUrl(client);
  const xtream = generateXtreamCredentials(client);

  const [m3uQR, xtreamQR] = await Promise.all([
    generateQRCode(m3uUrl),
    generateQRCode(`${xtream.host}/player_api.php?username=${xtream.username}&password=${xtream.password}`),
  ]);

  return {
    m3u: {
      label: 'M3U URL',
      url: m3uUrl,
      instructions: 'Copy this URL and paste into any M3U compatible player',
      qr: m3uQR,
    },
    xtream: {
      label: 'Xtream Codes API',
      host: xtream.host,
      username: xtream.username,
      password: xtream.password,
      qr: xtreamQR,
      instructions: 'Use these credentials in any Xtream Codes compatible app',
    },
    tivimate: {
      label: 'TiviMate',
      m3uUrl,
      epgUrl: `${client.xtreamHost}/xmltv.php?username=${client.username}&password=${client.password}`,
      instructions: `1. Open TiviMate\n2. Add Playlist → M3U URL\n3. Paste: ${m3uUrl}\n4. EPG URL: ${client.xtreamHost}/xmltv.php?username=${client.username}&password=${client.password}`,
      qr: m3uQR,
    },
    smartersPro: {
      label: 'IPTV Smarters Pro',
      host: xtream.host,
      username: xtream.username,
      password: xtream.password,
      instructions: `1. Open IPTV Smarters Pro\n2. Add User → Xtream Codes API\n3. Host: ${xtream.host}\n4. Username: ${xtream.username}\n5. Password: ${xtream.password}`,
      qr: xtreamQR,
    },
    gse: {
      label: 'GSE Smart IPTV',
      m3uUrl,
      instructions: `1. Open GSE Smart IPTV\n2. Remote Playlists → Add (+)\n3. Paste: ${m3uUrl}`,
      qr: m3uQR,
    },
    duplexPlay: {
      label: 'Duplex Play',
      host: xtream.host,
      username: xtream.username,
      password: xtream.password,
      instructions: `1. Open Duplex Play\n2. Settings → Playlist → Xtream\n3. Host: ${xtream.host}\n4. Username: ${xtream.username}\n5. Password: ${xtream.password}`,
      qr: xtreamQR,
    },
    kodi: {
      label: 'Kodi PVR IPTV Simple',
      m3uUrl,
      epgUrl: `${client.xtreamHost}/xmltv.php?username=${client.username}&password=${client.password}`,
      instructions: `1. Install PVR IPTV Simple Client addon\n2. Configure: M3U URL → ${m3uUrl}\n3. EPG URL → ${client.xtreamHost}/xmltv.php?username=${client.username}&password=${client.password}`,
      qr: m3uQR,
    },
    vlc: {
      label: 'VLC',
      m3uUrl,
      instructions: `1. Open VLC\n2. Media → Open Network Stream\n3. Paste: ${m3uUrl}`,
      qr: m3uQR,
    },
    ottNavigator: {
      label: 'OTT Navigator',
      host: xtream.host,
      username: xtream.username,
      password: xtream.password,
      instructions: `1. Open OTT Navigator\n2. Settings → Playlist → Xtream Codes\n3. Host: ${xtream.host}\n4. Username: ${xtream.username}\n5. Password: ${xtream.password}`,
      qr: xtreamQR,
    },
    perfectPlayer: {
      label: 'Perfect Player',
      m3uUrl,
      instructions: `1. Open Perfect Player\n2. Settings → Playlist\n3. Add: ${m3uUrl}`,
      qr: m3uQR,
    },
    lazyIptv: {
      label: 'Lazy IPTV',
      m3uUrl,
      instructions: `1. Open Lazy IPTV\n2. Add Playlist\n3. Paste: ${m3uUrl}`,
      qr: m3uQR,
    },
  };
}
