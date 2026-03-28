from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
import httpx
import re
from loguru import logger

router = APIRouter()


class M3UItem(BaseModel):
    name: str
    url: str
    group: Optional[str] = None
    logo: Optional[str] = None
    tvg_id: Optional[str] = None
    tvg_name: Optional[str] = None
    stream_type: str = "live"
    duration: int = -1


def parse_m3u_content(content: str) -> List[M3UItem]:
    """High-performance M3U parser"""
    lines = content.splitlines()
    items = []
    current = {}

    ext_inf_re = re.compile(
        r'^#EXTINF:(-?\d+)'
        r'(?:\s+tvg-id="([^"]*)")?'
        r'(?:\s+tvg-name="([^"]*)")?'
        r'(?:\s+tvg-logo="([^"]*)")?'
        r'(?:\s+group-title="([^"]*)")?'
        r'.*?,\s*(.+)$',
        re.IGNORECASE
    )

    # More flexible attribute extraction
    attr_re = {
        'tvg_id': re.compile(r'tvg-id="([^"]*)"', re.IGNORECASE),
        'tvg_name': re.compile(r'tvg-name="([^"]*)"', re.IGNORECASE),
        'tvg_logo': re.compile(r'tvg-logo="([^"]*)"', re.IGNORECASE),
        'logo': re.compile(r'(?<!tvg-)logo="([^"]*)"', re.IGNORECASE),
        'group': re.compile(r'group-title="([^"]*)"', re.IGNORECASE),
        'catchup': re.compile(r'catchup="([^"]*)"', re.IGNORECASE),
    }

    for line in lines:
        line = line.strip()
        if not line or line == '#EXTM3U':
            continue

        if line.startswith('#EXTINF:'):
            current = {}
            # Extract duration
            dur_match = re.match(r'^#EXTINF:(-?\d+)', line)
            current['duration'] = int(dur_match.group(1)) if dur_match else -1

            # Extract all attributes
            for attr, pattern in attr_re.items():
                m = pattern.search(line)
                if m:
                    current[attr] = m.group(1).strip()

            # Logo fallback
            if 'tvg_logo' in current and 'logo' not in current:
                current['logo'] = current['tvg_logo']

            # Extract title after last comma
            comma_pos = line.rfind(',')
            if comma_pos != -1:
                current['name'] = line[comma_pos + 1:].strip()
            continue

        if line.startswith('#'):
            continue

        if current.get('name') and line and not line.startswith('#'):
            stream_type = detect_stream_type(line, current.get('group', ''), current.get('name', ''))

            items.append(M3UItem(
                name=current.get('name', 'Unknown')[:255],
                url=line[:1999],
                group=current.get('group', '')[:150] if current.get('group') else None,
                logo=(current.get('logo') or current.get('tvg_logo') or '')[:999] or None,
                tvg_id=current.get('tvg_id', '')[:255] or None,
                tvg_name=current.get('tvg_name', '')[:255] or None,
                stream_type=stream_type,
                duration=current.get('duration', -1)
            ))
            current = {}

    return items


def detect_stream_type(url: str, group: str, name: str) -> str:
    """Detect if stream is live, VOD, or series"""
    url_lower = url.lower()
    group_lower = (group or '').lower()
    name_lower = (name or '').lower()

    # Check URL for VOD extensions
    if re.search(r'\.(mkv|mp4|avi|mov|flv|wmv|m4v)(\?|$)', url_lower):
        return 'vod'

    # Check for series episode pattern
    if re.search(r'[Ss]\d{1,3}[Ee]\d{1,3}', name):
        return 'series'

    # Group title hints
    vod_keywords = ['movie', 'film', 'vod', 'cinema', 'movies']
    series_keywords = ['series', 'show', 'season', 'tv show', 'episodes']

    for kw in vod_keywords:
        if kw in group_lower:
            return 'vod'

    for kw in series_keywords:
        if kw in group_lower or kw in name_lower:
            return 'series'

    return 'live'


@router.post("/parse-url")
async def parse_m3u_from_url(url: str = Form(...)):
    """Parse M3U from URL"""
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            response = await client.get(url, headers={
                'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18'
            })
            response.raise_for_status()
            content = response.text
    except httpx.HTTPError as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch M3U: {str(e)}")

    items = parse_m3u_content(content)
    return {
        "total": len(items),
        "items": items[:100],  # Return first 100 for preview
        "preview": True
    }


@router.post("/parse-file")
async def parse_m3u_from_file(file: UploadFile = File(...)):
    """Parse M3U from uploaded file"""
    if file.size and file.size > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 50MB)")

    content_bytes = await file.read()

    # Detect encoding
    try:
        content = content_bytes.decode('utf-8')
    except UnicodeDecodeError:
        try:
            content = content_bytes.decode('latin-1')
        except UnicodeDecodeError:
            content = content_bytes.decode('utf-8', errors='replace')

    items = parse_m3u_content(content)
    return {
        "total": len(items),
        "items": items[:100],
        "preview": True
    }


@router.post("/parse-full")
async def parse_m3u_full(url: Optional[str] = Form(None), file: Optional[UploadFile] = File(None)):
    """Parse M3U and return all items (for import)"""
    if url:
        try:
            async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
                response = await client.get(url, headers={'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18'})
                response.raise_for_status()
                content = response.text
        except httpx.HTTPError as e:
            raise HTTPException(status_code=400, detail=f"Failed to fetch M3U: {str(e)}")
    elif file:
        content_bytes = await file.read()
        try:
            content = content_bytes.decode('utf-8')
        except UnicodeDecodeError:
            content = content_bytes.decode('latin-1', errors='replace')
    else:
        raise HTTPException(status_code=400, detail="Provide url or file")

    items = parse_m3u_content(content)
    return {"total": len(items), "items": items}
