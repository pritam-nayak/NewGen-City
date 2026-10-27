const CITY_COORDINATES = { latitude: 28.9931, longitude: 77.0151 };
const CACHE_DURATION_MS = 10 * 60 * 1000;
const FORCE_REFRESH_MIN_INTERVAL_MS = 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;

let cachedConditions;
let cachedAt = 0;

const weatherDescriptions = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Freezing fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Heavy rain showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe thunderstorm',
};

async function fetchProvider(url, provider) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    throw new Error(`${provider} data could not be reached: ${error.message}`);
  }
  if (!response.ok) {
    throw new Error(`${provider} data provider returned HTTP ${response.status}.`);
  }
  return response.json();
}

function classifyAqi(value) {
  if (value <= 50) return { label: 'Good', tone: 'good' };
  if (value <= 100) return { label: 'Moderate', tone: 'moderate' };
  if (value <= 150) return { label: 'Unhealthy for sensitive groups', tone: 'sensitive' };
  if (value <= 200) return { label: 'Unhealthy', tone: 'unhealthy' };
  if (value <= 300) return { label: 'Very unhealthy', tone: 'very-unhealthy' };
  return { label: 'Hazardous', tone: 'hazardous' };
}

async function loadCityConditions() {
  const { latitude, longitude } = CITY_COORDINATES;
  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
  forecastUrl.search = new URLSearchParams({
    latitude,
    longitude,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
    forecast_days: '3',
    timezone: 'Asia/Kolkata',
  });
  const airQualityUrl = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  airQualityUrl.search = new URLSearchParams({
    latitude,
    longitude,
    current: 'pm2_5,pm10,us_aqi,european_aqi',
    timezone: 'Asia/Kolkata',
  });

  const results = await Promise.allSettled([
    fetchProvider(forecastUrl, 'Weather'),
    fetchProvider(airQualityUrl, 'Air quality'),
  ]);
  const [weatherResult, airQualityResult] = results;
  const errors = results
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason.message);

  if (weatherResult.status !== 'fulfilled' && airQualityResult.status !== 'fulfilled') {
    return {
      status: 'unavailable',
      location: 'Sonipat, Haryana',
      updatedAt: new Date().toISOString(),
      weather: { status: 'unavailable', error: weatherResult.reason.message },
      airQuality: { status: 'unavailable', error: airQualityResult.reason.message },
      errors,
      source: 'Open-Meteo',
    };
  }

  const currentWeather = weatherResult.status === 'fulfilled'
    ? weatherResult.value.current
    : null;
  const currentAirQuality = airQualityResult.status === 'fulfilled'
    ? airQualityResult.value.current
    : null;
  const usAqi = currentAirQuality?.us_aqi;
  const aqiDescription = Number.isFinite(usAqi)
    ? classifyAqi(usAqi)
    : { label: 'Not reported', tone: 'neutral' };

  return {
    status: errors.length ? 'partial' : 'live',
    location: 'Sonipat, Haryana',
    updatedAt: [currentWeather?.time, currentAirQuality?.time]
      .filter(Boolean)
      .sort()
      .at(-1),
    weather: currentWeather ? {
      status: 'live',
      temperatureC: currentWeather.temperature_2m,
      feelsLikeC: currentWeather.apparent_temperature,
      humidityPercent: currentWeather.relative_humidity_2m,
      precipitationMm: currentWeather.precipitation,
      windSpeedKmh: currentWeather.wind_speed_10m,
      condition: weatherDescriptions[currentWeather.weather_code] || `Weather code ${currentWeather.weather_code}`,
      observedAt: currentWeather.time,
      forecast: (weatherResult.value.daily?.time || []).map((date, index) => ({
        date,
        minimumC: weatherResult.value.daily.temperature_2m_min[index],
        maximumC: weatherResult.value.daily.temperature_2m_max[index],
        precipitationProbabilityPercent: weatherResult.value.daily.precipitation_probability_max[index],
        condition: weatherDescriptions[weatherResult.value.daily.weather_code[index]]
          || `Weather code ${weatherResult.value.daily.weather_code[index]}`,
      })),
    } : {
      status: 'unavailable',
      error: weatherResult.reason.message,
    },
    airQuality: currentAirQuality ? {
      status: 'live',
      usAqi,
      pm25: currentAirQuality.pm2_5,
      pm10: currentAirQuality.pm10,
      ...aqiDescription,
      observedAt: currentAirQuality.time,
    } : {
      status: 'unavailable',
      error: airQualityResult.reason.message,
    },
    errors,
    source: 'Open-Meteo',
  };
}

async function getCityConditions({ forceRefresh = false } = {}) {
  const cacheAge = Date.now() - cachedAt;
  if (
    cachedConditions
    && (cacheAge < CACHE_DURATION_MS
      || (forceRefresh && cacheAge < FORCE_REFRESH_MIN_INTERVAL_MS))
  ) {
    return { ...cachedConditions, cached: true };
  }
  const conditions = await loadCityConditions();
  cachedConditions = conditions;
  cachedAt = Date.now();
  return { ...conditions, cached: false };
}

module.exports = { getCityConditions };
