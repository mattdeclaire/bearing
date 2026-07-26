export const CONTINENTS = [
  "africa",
  "asia",
  "europe",
  "north-america",
  "oceania",
  "south-america",
] as const;

export type Continent = (typeof CONTINENTS)[number];

export interface City {
  name: string;
  country: string;
  lat: number;
  lon: number;
  continent: Continent;
}

export const CITIES: City[] = [
  // --- Africa ---
  { name: "Cairo", country: "Egypt", lat: 30.0444, lon: 31.2357, continent: "africa" },
  { name: "Lagos", country: "Nigeria", lat: 6.5244, lon: 3.3792, continent: "africa" },
  { name: "Nairobi", country: "Kenya", lat: -1.2921, lon: 36.8219, continent: "africa" },
  { name: "Johannesburg", country: "South Africa", lat: -26.2041, lon: 28.0473, continent: "africa" },
  { name: "Casablanca", country: "Morocco", lat: 33.5731, lon: -7.5898, continent: "africa" },
  { name: "Cape Town", country: "South Africa", lat: -33.9249, lon: 18.4241, continent: "africa" },
  { name: "Algiers", country: "Algeria", lat: 36.7538, lon: 3.0588, continent: "africa" },
  { name: "Tunis", country: "Tunisia", lat: 36.8065, lon: 10.1815, continent: "africa" },
  { name: "Dakar", country: "Senegal", lat: 14.7167, lon: -17.4677, continent: "africa" },
  { name: "Accra", country: "Ghana", lat: 5.6037, lon: -0.187, continent: "africa" },
  { name: "Abidjan", country: "Côte d'Ivoire", lat: 5.36, lon: -4.0083, continent: "africa" },
  { name: "Addis Ababa", country: "Ethiopia", lat: 9.0192, lon: 38.7525, continent: "africa" },
  { name: "Dar es Salaam", country: "Tanzania", lat: -6.7924, lon: 39.2083, continent: "africa" },
  { name: "Khartoum", country: "Sudan", lat: 15.5007, lon: 32.5599, continent: "africa" },
  { name: "Kinshasa", country: "DR Congo", lat: -4.4419, lon: 15.2663, continent: "africa" },
  { name: "Luanda", country: "Angola", lat: -8.839, lon: 13.2894, continent: "africa" },
  { name: "Lusaka", country: "Zambia", lat: -15.3875, lon: 28.3228, continent: "africa" },
  { name: "Harare", country: "Zimbabwe", lat: -17.8252, lon: 31.0335, continent: "africa" },
  { name: "Antananarivo", country: "Madagascar", lat: -18.8792, lon: 47.5079, continent: "africa" },
  { name: "Durban", country: "South Africa", lat: -29.8587, lon: 31.0218, continent: "africa" },

  // --- Asia ---
  { name: "Tokyo", country: "Japan", lat: 35.6762, lon: 139.6503, continent: "asia" },
  { name: "Delhi", country: "India", lat: 28.7041, lon: 77.1025, continent: "asia" },
  { name: "Shanghai", country: "China", lat: 31.2304, lon: 121.4737, continent: "asia" },
  { name: "Mumbai", country: "India", lat: 19.076, lon: 72.8777, continent: "asia" },
  { name: "Beijing", country: "China", lat: 39.9042, lon: 116.4074, continent: "asia" },
  { name: "Dhaka", country: "Bangladesh", lat: 23.8103, lon: 90.4125, continent: "asia" },
  { name: "Osaka", country: "Japan", lat: 34.6937, lon: 135.5023, continent: "asia" },
  { name: "Karachi", country: "Pakistan", lat: 24.8607, lon: 67.0011, continent: "asia" },
  { name: "Kolkata", country: "India", lat: 22.5726, lon: 88.3639, continent: "asia" },
  { name: "Manila", country: "Philippines", lat: 14.5995, lon: 120.9842, continent: "asia" },
  { name: "Jakarta", country: "Indonesia", lat: -6.2088, lon: 106.8456, continent: "asia" },
  { name: "Bangkok", country: "Thailand", lat: 13.7563, lon: 100.5018, continent: "asia" },
  { name: "Seoul", country: "South Korea", lat: 37.5665, lon: 126.978, continent: "asia" },
  { name: "Nagoya", country: "Japan", lat: 35.1815, lon: 136.9066, continent: "asia" },
  { name: "Tehran", country: "Iran", lat: 35.6892, lon: 51.389, continent: "asia" },
  { name: "Chengdu", country: "China", lat: 30.5728, lon: 104.0668, continent: "asia" },
  { name: "Ho Chi Minh City", country: "Vietnam", lat: 10.8231, lon: 106.6297, continent: "asia" },
  { name: "Hong Kong", country: "China", lat: 22.3193, lon: 114.1694, continent: "asia" },
  { name: "Riyadh", country: "Saudi Arabia", lat: 24.7136, lon: 46.6753, continent: "asia" },
  { name: "Singapore", country: "Singapore", lat: 1.3521, lon: 103.8198, continent: "asia" },
  { name: "Dubai", country: "United Arab Emirates", lat: 25.2048, lon: 55.2708, continent: "asia" },
  { name: "Kuala Lumpur", country: "Malaysia", lat: 3.139, lon: 101.6869, continent: "asia" },
  { name: "Almaty", country: "Kazakhstan", lat: 43.222, lon: 76.8512, continent: "asia" },
  { name: "Ulaanbaatar", country: "Mongolia", lat: 47.8864, lon: 106.9057, continent: "asia" },

  // --- Europe ---
  // Istanbul and Moscow count as Europe: both city centers sit west of the
  // conventional Bosphorus/Urals dividing lines.
  { name: "Istanbul", country: "Turkey", lat: 41.0082, lon: 28.9784, continent: "europe" },
  { name: "Moscow", country: "Russia", lat: 55.7558, lon: 37.6173, continent: "europe" },
  { name: "Paris", country: "France", lat: 48.8566, lon: 2.3522, continent: "europe" },
  { name: "London", country: "United Kingdom", lat: 51.5074, lon: -0.1278, continent: "europe" },
  { name: "Madrid", country: "Spain", lat: 40.4168, lon: -3.7038, continent: "europe" },
  { name: "Berlin", country: "Germany", lat: 52.52, lon: 13.405, continent: "europe" },
  { name: "Rome", country: "Italy", lat: 41.9028, lon: 12.4964, continent: "europe" },
  { name: "Athens", country: "Greece", lat: 37.9838, lon: 23.7275, continent: "europe" },
  { name: "Lisbon", country: "Portugal", lat: 38.7223, lon: -9.1393, continent: "europe" },
  { name: "Amsterdam", country: "Netherlands", lat: 52.3676, lon: 4.9041, continent: "europe" },
  { name: "Stockholm", country: "Sweden", lat: 59.3293, lon: 18.0686, continent: "europe" },
  { name: "Vienna", country: "Austria", lat: 48.2082, lon: 16.3738, continent: "europe" },
  { name: "Dublin", country: "Ireland", lat: 53.3498, lon: -6.2603, continent: "europe" },
  { name: "Helsinki", country: "Finland", lat: 60.1699, lon: 24.9384, continent: "europe" },
  { name: "Oslo", country: "Norway", lat: 59.9139, lon: 10.7522, continent: "europe" },
  { name: "Warsaw", country: "Poland", lat: 52.2297, lon: 21.0122, continent: "europe" },
  { name: "Prague", country: "Czechia", lat: 50.0755, lon: 14.4378, continent: "europe" },
  { name: "Budapest", country: "Hungary", lat: 47.4979, lon: 19.0402, continent: "europe" },
  { name: "Reykjavík", country: "Iceland", lat: 64.1466, lon: -21.9426, continent: "europe" },
  { name: "Kyiv", country: "Ukraine", lat: 50.4501, lon: 30.5234, continent: "europe" },
  { name: "Copenhagen", country: "Denmark", lat: 55.6761, lon: 12.5683, continent: "europe" },

  // --- North America ---
  { name: "Mexico City", country: "Mexico", lat: 19.4326, lon: -99.1332, continent: "north-america" },
  { name: "New York", country: "United States", lat: 40.7128, lon: -74.006, continent: "north-america" },
  { name: "Los Angeles", country: "United States", lat: 34.0522, lon: -118.2437, continent: "north-america" },
  { name: "Chicago", country: "United States", lat: 41.8781, lon: -87.6298, continent: "north-america" },
  { name: "Toronto", country: "Canada", lat: 43.6532, lon: -79.3832, continent: "north-america" },
  { name: "Havana", country: "Cuba", lat: 23.1136, lon: -82.3666, continent: "north-america" },
  { name: "Anchorage", country: "United States", lat: 61.2181, lon: -149.9003, continent: "north-america" },
  { name: "Vancouver", country: "Canada", lat: 49.2827, lon: -123.1207, continent: "north-america" },
  { name: "Seattle", country: "United States", lat: 47.6062, lon: -122.3321, continent: "north-america" },
  { name: "San Francisco", country: "United States", lat: 37.7749, lon: -122.4194, continent: "north-america" },
  { name: "Denver", country: "United States", lat: 39.7392, lon: -104.9903, continent: "north-america" },
  { name: "Houston", country: "United States", lat: 29.7604, lon: -95.3698, continent: "north-america" },
  { name: "Miami", country: "United States", lat: 25.7617, lon: -80.1918, continent: "north-america" },
  { name: "Atlanta", country: "United States", lat: 33.749, lon: -84.388, continent: "north-america" },
  { name: "Montreal", country: "Canada", lat: 45.5019, lon: -73.5674, continent: "north-america" },
  { name: "Winnipeg", country: "Canada", lat: 49.8951, lon: -97.1384, continent: "north-america" },
  { name: "Guadalajara", country: "Mexico", lat: 20.6597, lon: -103.3496, continent: "north-america" },
  { name: "Guatemala City", country: "Guatemala", lat: 14.6349, lon: -90.5069, continent: "north-america" },
  { name: "Panama City", country: "Panama", lat: 8.9824, lon: -79.5199, continent: "north-america" },
  { name: "Kingston", country: "Jamaica", lat: 17.9712, lon: -76.7936, continent: "north-america" },

  // --- Oceania ---
  // Honolulu is grouped with Oceania (Polynesia): Hawaiian players get a
  // Pacific puzzle with real bearing spread instead of an all-northeast
  // mainland-America one.
  { name: "Sydney", country: "Australia", lat: -33.8688, lon: 151.2093, continent: "oceania" },
  { name: "Melbourne", country: "Australia", lat: -37.8136, lon: 144.9631, continent: "oceania" },
  { name: "Auckland", country: "New Zealand", lat: -36.8509, lon: 174.7645, continent: "oceania" },
  { name: "Honolulu", country: "United States", lat: 21.3099, lon: -157.8581, continent: "oceania" },
  { name: "Brisbane", country: "Australia", lat: -27.4698, lon: 153.0251, continent: "oceania" },
  { name: "Perth", country: "Australia", lat: -31.9505, lon: 115.8605, continent: "oceania" },
  { name: "Adelaide", country: "Australia", lat: -34.9285, lon: 138.6007, continent: "oceania" },
  { name: "Darwin", country: "Australia", lat: -12.4634, lon: 130.8456, continent: "oceania" },
  { name: "Wellington", country: "New Zealand", lat: -41.2865, lon: 174.7762, continent: "oceania" },
  { name: "Christchurch", country: "New Zealand", lat: -43.5321, lon: 172.6362, continent: "oceania" },
  { name: "Suva", country: "Fiji", lat: -18.1416, lon: 178.4419, continent: "oceania" },
  { name: "Port Moresby", country: "Papua New Guinea", lat: -9.4438, lon: 147.1803, continent: "oceania" },

  // --- South America ---
  { name: "São Paulo", country: "Brazil", lat: -23.5505, lon: -46.6333, continent: "south-america" },
  { name: "Rio de Janeiro", country: "Brazil", lat: -22.9068, lon: -43.1729, continent: "south-america" },
  { name: "Buenos Aires", country: "Argentina", lat: -34.6037, lon: -58.3816, continent: "south-america" },
  { name: "Bogotá", country: "Colombia", lat: 4.711, lon: -74.0721, continent: "south-america" },
  { name: "Lima", country: "Peru", lat: -12.0464, lon: -77.0428, continent: "south-america" },
  { name: "Santiago", country: "Chile", lat: -33.4489, lon: -70.6693, continent: "south-america" },
  { name: "Caracas", country: "Venezuela", lat: 10.4806, lon: -66.9036, continent: "south-america" },
  { name: "Quito", country: "Ecuador", lat: -0.1807, lon: -78.4678, continent: "south-america" },
  { name: "Montevideo", country: "Uruguay", lat: -34.9011, lon: -56.1645, continent: "south-america" },
  { name: "Brasília", country: "Brazil", lat: -15.8267, lon: -47.9218, continent: "south-america" },
  { name: "Medellín", country: "Colombia", lat: 6.2442, lon: -75.5812, continent: "south-america" },
  { name: "La Paz", country: "Bolivia", lat: -16.4897, lon: -68.1193, continent: "south-america" },
  { name: "Asunción", country: "Paraguay", lat: -25.2637, lon: -57.5759, continent: "south-america" },
  { name: "Recife", country: "Brazil", lat: -8.0476, lon: -34.877, continent: "south-america" },
];
