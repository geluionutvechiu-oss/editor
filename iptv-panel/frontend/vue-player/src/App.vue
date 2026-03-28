<template>
  <div class="player-app" :class="{ 'dark': true }">
    <div class="app-layout">
      <!-- Sidebar: Channel List -->
      <aside class="channel-sidebar" :class="{ open: sidebarOpen }">
        <div class="sidebar-header">
          <div class="sidebar-logo">
            <span class="logo-icon">📺</span>
            <span class="logo-text">IPTV</span>
          </div>
          <button class="close-sidebar" @click="sidebarOpen = false">✕</button>
        </div>

        <!-- Search -->
        <div class="search-wrapper">
          <input v-model="searchQuery" type="text" placeholder="Search channels..."
            class="channel-search" @input="filterChannels" />
        </div>

        <!-- Category tabs -->
        <div class="categories-tabs">
          <button
            v-for="cat in categories"
            :key="cat.id"
            :class="['cat-tab', { active: selectedCategory === cat.id }]"
            @click="selectCategory(cat.id)"
          >
            {{ cat.category_name }}
          </button>
        </div>

        <!-- Channel list -->
        <div class="channel-list">
          <div v-if="loadingChannels" class="loading-channels">
            <div v-for="i in 8" :key="i" class="channel-skeleton" />
          </div>
          <button
            v-else
            v-for="ch in filteredChannels"
            :key="ch.id"
            :class="['channel-item', { active: currentChannel?.id === ch.id }]"
            @click="selectChannel(ch)"
          >
            <div class="ch-logo">
              <img v-if="ch.stream_icon" :src="ch.stream_icon" :alt="ch.name"
                @error="($event.target as HTMLImageElement).style.display='none'" />
              <span v-else class="ch-logo-fallback">📺</span>
            </div>
            <div class="ch-info">
              <p class="ch-name">{{ ch.name }}</p>
              <p v-if="nowPlaying[ch.epg_channel_id]" class="ch-epg">
                {{ nowPlaying[ch.epg_channel_id]?.title }}
              </p>
            </div>
            <span v-if="ch.stream_status === 'online'" class="ch-status online" />
            <span v-else-if="ch.stream_status === 'offline'" class="ch-status offline" />
          </button>
        </div>
      </aside>

      <!-- Main: Player + EPG -->
      <main class="player-main">
        <!-- Top bar -->
        <div class="player-topbar">
          <button class="menu-btn" @click="sidebarOpen = !sidebarOpen">☰</button>
          <div class="topbar-channel-info" v-if="currentChannel">
            <img v-if="currentChannel.stream_icon" :src="currentChannel.stream_icon"
              class="topbar-logo" @error="($event.target as HTMLImageElement).style.display='none'" />
            <span class="topbar-name">{{ currentChannel.name }}</span>
          </div>
          <div class="topbar-actions">
            <button class="topbar-btn" @click="refreshChannel" title="Refresh stream">↺</button>
          </div>
        </div>

        <!-- Player -->
        <div class="player-container">
          <LivePlayer
            v-if="currentChannel"
            :channel="currentChannel"
            :credentials="credentials"
            :base-url="baseUrl"
            @playing="onPlaying"
            @error="onPlayerError"
          />
          <div v-else class="no-channel">
            <div class="no-channel-icon">📺</div>
            <p>Select a channel to start watching</p>
          </div>
        </div>

        <!-- EPG Guide -->
        <div v-if="currentChannel && epgGuide.length > 0" class="epg-guide">
          <h3 class="epg-title">
            Programme Guide — {{ currentChannel.name }}
          </h3>
          <div class="epg-list">
            <div
              v-for="prog in epgGuide.slice(0, 12)"
              :key="prog.epg_id"
              :class="['epg-item', { current: isCurrentProg(prog) }]"
            >
              <div class="epg-time">
                <span>{{ formatTime(prog.start) }}</span>
                <span class="epg-duration">{{ calcDuration(prog.start, prog.end) }}</span>
              </div>
              <div class="epg-content">
                <p class="epg-prog-title">{{ prog.title }}</p>
                <p v-if="prog.description" class="epg-desc">{{ prog.description }}</p>
              </div>
              <div v-if="isCurrentProg(prog)" class="epg-now-badge">NOW</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import axios from 'axios';
import LivePlayer from './components/LivePlayer.vue';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
dayjs.extend(duration);

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const credentials = ref<{ username: string; password: string } | undefined>(undefined);
const baseUrl = ref(import.meta.env.VITE_BASE_URL || window.location.origin);

const channels = ref<any[]>([]);
const filteredChannels = ref<any[]>([]);
const categories = ref<any[]>([]);
const currentChannel = ref<any>(null);
const selectedCategory = ref<number | null>(null);
const searchQuery = ref('');
const sidebarOpen = ref(true);
const loadingChannels = ref(true);
const nowPlaying = ref<Record<string, any>>({});
const epgGuide = ref<any[]>([]);
const error = ref('');

// Auth from URL params or localStorage
function initAuth() {
  const params = new URLSearchParams(window.location.search);
  const u = params.get('username') || localStorage.getItem('iptv_username') || '';
  const p = params.get('password') || localStorage.getItem('iptv_password') || '';
  if (u && p) {
    credentials.value = { username: u, password: p };
    localStorage.setItem('iptv_username', u);
    localStorage.setItem('iptv_password', p);
  }
}

async function loadChannels() {
  loadingChannels.value = true;
  try {
    let url = `${API_BASE}/streams?limit=500`;
    if (selectedCategory.value) url += `&category_id=${selectedCategory.value}`;

    // If credentials, use Xtream API
    if (credentials.value) {
      const { username, password } = credentials.value;
      const response = await axios.get(`/player_api.php`, {
        params: { username, password, action: 'get_live_streams', category_id: selectedCategory.value || undefined }
      });
      channels.value = (response.data || []).map((s: any) => ({
        ...s,
        id: s.stream_id,
        stream_status: s.stream_status === 1 ? 'online' : 'unknown'
      }));
    } else {
      const token = localStorage.getItem('iptv_token');
      const response = await axios.get(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      channels.value = response.data?.data || [];
    }

    filteredChannels.value = channels.value;

    // Load now playing EPG for visible channels
    loadNowPlaying();
  } catch (err) {
    console.error('Failed to load channels:', err);
  } finally {
    loadingChannels.value = false;
  }
}

async function loadCategories() {
  try {
    if (credentials.value) {
      const { username, password } = credentials.value;
      const response = await axios.get('/player_api.php', {
        params: { username, password, action: 'get_live_categories' }
      });
      categories.value = [{ id: null, category_name: 'All' }, ...(response.data || []).map((c: any) => ({
        id: c.category_id,
        category_name: c.category_name
      }))];
    } else {
      const response = await axios.get(`${API_BASE}/streams/categories/list`);
      categories.value = [{ id: null, category_name: 'All' }, ...(response.data?.data || [])];
    }
  } catch {}
}

async function loadNowPlaying() {
  const channelIds = channels.value
    .slice(0, 50)
    .map(c => c.epg_channel_id)
    .filter(Boolean);

  if (!channelIds.length) return;

  try {
    const token = localStorage.getItem('iptv_token');
    const response = await axios.get(`${API_BASE}/epg/now`, {
      params: { channel_ids: channelIds.join(',') },
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    nowPlaying.value = response.data?.data || {};
  } catch {}
}

async function loadEpgGuide(channelId: string) {
  try {
    const token = localStorage.getItem('iptv_token');
    const response = await axios.get(`${API_BASE}/epg/guide/${channelId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    epgGuide.value = response.data?.data || [];
  } catch {
    epgGuide.value = [];
  }
}

function selectChannel(channel: any) {
  currentChannel.value = channel;
  if (window.innerWidth < 768) sidebarOpen.value = false;

  if (channel.epg_channel_id) {
    loadEpgGuide(channel.epg_channel_id);
  } else {
    epgGuide.value = [];
  }
}

function selectCategory(catId: number | null) {
  selectedCategory.value = catId;
  loadChannels();
}

function filterChannels() {
  const q = searchQuery.value.toLowerCase();
  if (!q) {
    filteredChannels.value = channels.value;
    return;
  }
  filteredChannels.value = channels.value.filter(c =>
    c.name.toLowerCase().includes(q)
  );
}

function refreshChannel() {
  if (currentChannel.value) {
    const ch = currentChannel.value;
    currentChannel.value = null;
    setTimeout(() => { currentChannel.value = ch; }, 100);
  }
}

function onPlaying() {}
function onPlayerError(err: string) {
  console.error('Player error:', err);
}

function formatTime(timeStr: string) {
  return dayjs(timeStr).format('HH:mm');
}

function calcDuration(start: string, end: string) {
  const mins = dayjs(end).diff(dayjs(start), 'minute');
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function isCurrentProg(prog: any) {
  const now = dayjs();
  return dayjs(prog.start).isBefore(now) && dayjs(prog.end).isAfter(now);
}

onMounted(async () => {
  initAuth();
  await Promise.all([loadCategories(), loadChannels()]);
});
</script>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0f1117; color: #e5e7eb; font-family: system-ui, sans-serif; }

.player-app { min-height: 100vh; background: #0f1117; }
.app-layout { display: flex; height: 100vh; overflow: hidden; }

/* Sidebar */
.channel-sidebar {
  width: 300px;
  flex-shrink: 0;
  background: #161b22;
  border-right: 1px solid #2d3748;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: transform 0.2s;
}
@media (max-width: 768px) {
  .channel-sidebar { position: fixed; inset-y: 0; left: 0; z-index: 50; transform: translateX(-100%); }
  .channel-sidebar.open { transform: translateX(0); }
}
.sidebar-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px; border-bottom: 1px solid #2d3748; flex-shrink: 0;
}
.sidebar-logo { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 1.1rem; }
.logo-icon { font-size: 1.4rem; }
.close-sidebar { background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 1.1rem; display: none; }
@media (max-width: 768px) { .close-sidebar { display: block; } }

.search-wrapper { padding: 12px; flex-shrink: 0; }
.channel-search {
  width: 100%; padding: 8px 12px; background: #1f2937;
  border: 1px solid #374151; border-radius: 8px; color: #e5e7eb;
  font-size: 0.875rem; outline: none;
}
.channel-search:focus { border-color: #6366f1; }

.categories-tabs {
  display: flex; gap: 4px; padding: 0 12px 8px; overflow-x: auto; flex-shrink: 0;
  scrollbar-width: none;
}
.categories-tabs::-webkit-scrollbar { display: none; }
.cat-tab {
  padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 500;
  white-space: nowrap; cursor: pointer; border: 1px solid #374151;
  background: transparent; color: #9ca3af; transition: all 0.15s;
}
.cat-tab.active { background: #6366f1; border-color: #6366f1; color: white; }
.cat-tab:hover:not(.active) { border-color: #6366f1; color: #a5b4fc; }

.channel-list { flex: 1; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #374151 transparent; }
.channel-skeleton {
  height: 64px; margin: 4px 8px; background: #1f2937;
  border-radius: 8px; animation: shimmer 1.5s infinite;
}
@keyframes shimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

.channel-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; width: 100%; background: none; border: none;
  cursor: pointer; text-align: left; color: #e5e7eb;
  transition: background 0.15s; position: relative;
}
.channel-item:hover { background: #1f2937; }
.channel-item.active { background: #312e81; border-left: 3px solid #6366f1; }
.ch-logo { width: 36px; height: 36px; flex-shrink: 0; border-radius: 6px; overflow: hidden; background: #1f2937; display: flex; align-items: center; justify-content: center; }
.ch-logo img { width: 100%; height: 100%; object-fit: contain; }
.ch-logo-fallback { font-size: 1.2rem; }
.ch-info { flex: 1; min-width: 0; }
.ch-name { font-size: 0.875rem; font-weight: 500; truncate: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ch-epg { font-size: 0.7rem; color: #9ca3af; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
.ch-status { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.ch-status.online { background: #10b981; }
.ch-status.offline { background: #ef4444; }

/* Main Player */
.player-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.player-topbar {
  display: flex; align-items: center; gap: 12px; padding: 0 16px;
  height: 52px; background: #161b22; border-bottom: 1px solid #2d3748; flex-shrink: 0;
}
.menu-btn { background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 1.2rem; padding: 6px; }
.topbar-channel-info { display: flex; align-items: center; gap: 8px; flex: 1; }
.topbar-logo { width: 28px; height: 28px; object-fit: contain; border-radius: 4px; }
.topbar-name { font-size: 0.9rem; font-weight: 600; }
.topbar-actions { display: flex; gap: 6px; }
.topbar-btn { background: #1f2937; border: 1px solid #374151; color: #9ca3af; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 1rem; }
.topbar-btn:hover { color: white; }

.player-container {
  flex: 1; background: #000; position: relative; min-height: 200px;
  max-height: calc(100vh - 52px - 200px);
}
.no-channel {
  width: 100%; height: 100%; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px; color: #9ca3af;
}
.no-channel-icon { font-size: 4rem; }
.no-channel p { font-size: 1rem; }

/* EPG Guide */
.epg-guide {
  height: 200px; overflow-y: auto; background: #161b22;
  border-top: 1px solid #2d3748; scrollbar-width: thin; flex-shrink: 0;
}
.epg-title { padding: 12px 16px 8px; font-size: 0.8rem; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; }
.epg-list { display: flex; flex-direction: column; }
.epg-item {
  display: flex; align-items: flex-start; gap: 12px; padding: 8px 16px;
  border-bottom: 1px solid #1f2937; position: relative;
}
.epg-item.current { background: #1a1f35; }
.epg-time { font-size: 0.75rem; color: #9ca3af; min-width: 60px; flex-shrink: 0; }
.epg-duration { display: block; font-size: 0.65rem; color: #6b7280; margin-top: 2px; }
.epg-content { flex: 1; min-width: 0; }
.epg-prog-title { font-size: 0.8rem; font-weight: 500; }
.epg-desc { font-size: 0.7rem; color: #9ca3af; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.epg-now-badge {
  font-size: 0.65rem; font-weight: 700; background: #ef4444;
  color: white; padding: 2px 6px; border-radius: 3px; flex-shrink: 0;
}
</style>
