export interface CurrencyRate {
  usdTry: number;
  eurTry: number;
  rateDate: string;
  source: string;
}

export interface GoldRate {
  gramTry: number | null;
  updatedAt: string;
  source: string;
}

export interface WeatherInfo {
  temperatureC: number;
  apparentTemperatureC: number;
  weatherCode: number;
  condition: string;
  isDay: boolean;
  location: string;
  updatedAt: string;
  source: string;
}

export interface MarketDataResponse {
  currency: CurrencyRate | null;
  gold: GoldRate;
  weather: WeatherInfo | null;
  fetchedAt: string;
  errors: {
    currency: string | null;
    gold: string | null;
    weather: string | null;
  };
}
