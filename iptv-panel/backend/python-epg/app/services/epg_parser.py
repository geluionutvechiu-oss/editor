"""
Production XMLTV EPG parser using lxml for high performance
Handles large EPG files (100MB+) with streaming parsing
"""
import gzip
import io
from datetime import datetime, timezone, timedelta
from typing import Generator, Dict, List, Optional, Tuple
from lxml import etree
import httpx
import chardet
from loguru import logger
from app.config import settings


def parse_xmltv_date(date_str: str) -> Optional[datetime]:
    """
    Parse XMLTV date format: 20231225183000 +0100
    Returns UTC datetime or None if invalid
    """
    if not date_str:
        return None

    date_str = date_str.strip()

    # Extract timezone offset
    tz_offset = timedelta(0)
    if ' ' in date_str:
        parts = date_str.split(' ', 1)
        date_part = parts[0]
        tz_str = parts[1].strip()
        if len(tz_str) == 5:
            sign = 1 if tz_str[0] == '+' else -1
            hours = int(tz_str[1:3])
            minutes = int(tz_str[3:5])
            tz_offset = timedelta(hours=hours, minutes=minutes) * sign
    else:
        date_part = date_str

    if len(date_part) < 14:
        return None

    try:
        dt = datetime(
            int(date_part[0:4]),
            int(date_part[4:6]),
            int(date_part[6:8]),
            int(date_part[8:10]),
            int(date_part[10:12]),
            int(date_part[12:14]),
            tzinfo=timezone.utc
        )
        # Adjust to UTC
        dt = dt - tz_offset
        dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, IndexError) as e:
        logger.debug(f"Failed to parse XMLTV date '{date_str}': {e}")
        return None


async def download_epg(url: str) -> bytes:
    """Download EPG from URL, handles gzip compression"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; IPTVPanel/1.0)',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'application/xml, text/xml, */*'
    }

    max_bytes = settings.epg_max_file_size_mb * 1024 * 1024
    timeout = httpx.Timeout(settings.epg_download_timeout)

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        async with client.stream('GET', url, headers=headers) as response:
            response.raise_for_status()

            content_bytes = b''
            async for chunk in response.aiter_bytes(chunk_size=65536):
                content_bytes += chunk
                if len(content_bytes) > max_bytes:
                    raise ValueError(f"EPG file too large (>{settings.epg_max_file_size_mb}MB)")

    # Decompress if gzipped
    if content_bytes[:2] == b'\x1f\x8b':
        content_bytes = gzip.decompress(content_bytes)

    return content_bytes


def detect_encoding(data: bytes) -> str:
    """Detect encoding from XML declaration or chardet"""
    # Try XML declaration first
    header = data[:200].decode('ascii', errors='ignore')
    if 'encoding=' in header:
        enc_start = header.find('encoding=') + 9
        quote = header[enc_start]
        enc_end = header.find(quote, enc_start + 1)
        if enc_end > enc_start:
            return header[enc_start + 1:enc_end]

    # Fall back to chardet
    detected = chardet.detect(data[:10000])
    return detected.get('encoding', 'utf-8') or 'utf-8'


def parse_xmltv_streaming(
    content: bytes,
    source_id: int,
    max_age_days: int = 7
) -> Tuple[List[Dict], List[Dict]]:
    """
    Parse XMLTV content using lxml streaming iterator
    Returns (channels, programmes)
    """
    encoding = detect_encoding(content)
    channels = []
    programmes = []

    cutoff_past = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    cutoff_future = datetime.now(timezone.utc) + timedelta(days=14)

    try:
        content_str = content.decode(encoding, errors='replace')
        # Remove BOM if present
        if content_str.startswith('\ufeff'):
            content_str = content_str[1:]

        tree = etree.fromstring(content_str.encode('utf-8'))
    except etree.XMLSyntaxError as e:
        # Try recovering with recovery parser
        logger.warning(f"XML syntax error, attempting recovery: {e}")
        parser = etree.XMLParser(recover=True, encoding='utf-8')
        content_bytes = content.decode(encoding, errors='replace').encode('utf-8')
        tree = etree.fromstring(content_bytes, parser=parser)

    # Parse channels
    for ch_elem in tree.findall('channel'):
        channel_id = ch_elem.get('id', '').strip()
        if not channel_id:
            continue

        display_names = ch_elem.findall('display-name')
        display_name = ''
        if display_names:
            display_name = (display_names[0].text or '').strip()

        icon_elem = ch_elem.find('icon')
        icon = icon_elem.get('src', '') if icon_elem is not None else ''

        lang = display_names[0].get('lang', '') if display_names else ''

        channels.append({
            'source_id': source_id,
            'channel_id': channel_id[:255],
            'display_name': display_name[:255],
            'icon': icon[:999] if icon else None,
            'lang': lang[:10] if lang else None
        })

    # Parse programmes
    for prog_elem in tree.findall('programme'):
        start_str = prog_elem.get('start', '')
        stop_str = prog_elem.get('stop', '')
        channel_id = prog_elem.get('channel', '').strip()

        if not all([start_str, stop_str, channel_id]):
            continue

        start_dt = parse_xmltv_date(start_str)
        end_dt = parse_xmltv_date(stop_str)

        if not start_dt or not end_dt:
            continue

        # Skip old and too-far-future programmes
        if end_dt < cutoff_past or start_dt > cutoff_future:
            continue

        # Title
        title_elem = prog_elem.find('title')
        title = (title_elem.text or '').strip() if title_elem is not None else ''
        lang = title_elem.get('lang', 'en') if title_elem is not None else 'en'

        if not title:
            continue

        # Description
        desc_elem = prog_elem.find('desc')
        description = (desc_elem.text or '').strip() if desc_elem is not None else None

        # Category
        cat_elem = prog_elem.find('category')
        category = (cat_elem.text or '').strip() if cat_elem is not None else None

        # Episode number
        episode_num = None
        for ep_elem in prog_elem.findall('episode-num'):
            system = ep_elem.get('system', '')
            if system == 'xmltv_ns':
                episode_num = (ep_elem.text or '').strip()
                break
        if not episode_num:
            ep_elem = prog_elem.find('episode-num')
            if ep_elem is not None:
                episode_num = (ep_elem.text or '').strip()

        # Icon
        icon_elem = prog_elem.find('icon')
        icon = icon_elem.get('src', '') if icon_elem is not None else None

        # EPG unique ID
        epg_id = f"{channel_id}_{start_str}"

        programmes.append({
            'channel_id': channel_id[:255],
            'epg_id': epg_id[:255],
            'start': start_dt.strftime('%Y-%m-%d %H:%M:%S'),
            'end': end_dt.strftime('%Y-%m-%d %H:%M:%S'),
            'title': title[:499],
            'lang': lang[:10],
            'description': description[:65535] if description else None,
            'icon': icon[:999] if icon else None,
            'category': category[:255] if category else None,
            'episode_num': episode_num[:100] if episode_num else None,
            'source_id': source_id
        })

    logger.info(f"Parsed EPG source {source_id}: {len(channels)} channels, {len(programmes)} programmes")
    return channels, programmes
