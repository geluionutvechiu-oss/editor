const axios = require('axios');
const { cache } = require('../config/redis');
const logger = require('../config/logger');

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

function getApiKey() {
  return process.env.TMDB_API_KEY || '';
}

function buildImageUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${TMDB_IMAGE_BASE}${path}`;
}

async function tmdbGet(endpoint, params = {}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('TMDB_API_KEY not configured');

  const cacheKey = `tmdb:${endpoint}:${JSON.stringify(params)}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  try {
    const response = await axios.get(`${TMDB_BASE}${endpoint}`, {
      params: { api_key: apiKey, ...params },
      timeout: 10000
    });

    await cache.set(cacheKey, response.data, 86400); // Cache for 24h
    return response.data;
  } catch (err) {
    logger.error('TMDB API error', { endpoint, err: err.message });
    throw err;
  }
}

async function fetchTMDBMovie(tmdbId) {
  const data = await tmdbGet(`/movie/${tmdbId}`, {
    append_to_response: 'credits,videos,images'
  });

  return {
    ...data,
    poster_path: buildImageUrl(data.poster_path),
    backdrop_path: buildImageUrl(data.backdrop_path)
  };
}

async function fetchTMDBSeries(tmdbId) {
  const data = await tmdbGet(`/tv/${tmdbId}`, {
    append_to_response: 'credits,videos,images'
  });

  return {
    ...data,
    poster_path: buildImageUrl(data.poster_path),
    backdrop_path: buildImageUrl(data.backdrop_path)
  };
}

async function fetchTMDBSeriesSeasons(tmdbId, seasonNum) {
  return tmdbGet(`/tv/${tmdbId}/season/${seasonNum}`);
}

async function searchTMDBMovie(title, year = null) {
  const params = { query: title };
  if (year) params.year = year;

  const data = await tmdbGet('/search/movie', params);
  if (!data.results?.length) return null;

  const result = data.results[0];
  return {
    ...result,
    poster_path: buildImageUrl(result.poster_path),
    backdrop_path: buildImageUrl(result.backdrop_path)
  };
}

async function searchTMDBSeries(title, year = null) {
  const params = { query: title };
  if (year) params.first_air_date_year = year;

  const data = await tmdbGet('/search/tv', params);
  if (!data.results?.length) return null;

  const result = data.results[0];
  return {
    ...result,
    poster_path: buildImageUrl(result.poster_path),
    backdrop_path: buildImageUrl(result.backdrop_path)
  };
}

async function getTMDBGenres(mediaType = 'movie') {
  const data = await tmdbGet(`/genre/${mediaType}/list`);
  return data.genres || [];
}

module.exports = {
  fetchTMDBMovie,
  fetchTMDBSeries,
  fetchTMDBSeriesSeasons,
  searchTMDBMovie,
  searchTMDBSeries,
  getTMDBGenres,
  buildImageUrl
};
