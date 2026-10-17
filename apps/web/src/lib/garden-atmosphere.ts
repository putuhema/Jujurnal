import type { MoodGrade } from "./garden-procedural";

// The garden's sky follows real life: the time of day and season where you
// are, and a weather made from your last week of moods.

export type DayPart = "dawn" | "day" | "dusk" | "night";
export type Season = "spring" | "summer" | "autumn" | "winter";
export type Weather = "sunny" | "fair" | "cloudy" | "rain";

export const getDayPart = (date = new Date()): DayPart => {
  const hour = date.getHours() + date.getMinutes() / 60;
  if (hour >= 5 && hour < 7.5) return "dawn";
  if (hour >= 7.5 && hour < 17.5) return "day";
  if (hour >= 17.5 && hour < 20) return "dusk";
  return "night";
};

// Time zones south of the equator get their seasons flipped.
const southern = /^(Australia|Antarctica|Pacific\/(Auckland|Chatham|Fiji|Tongatapu|Apia|Noumea)|America\/(Argentina|Sao_Paulo|Santiago|Montevideo|Asuncion|La_Paz|Lima|Bahia|Recife|Fortaleza|Belem|Cuiaba|Campo_Grande|Porto_Velho|Manaus)|Africa\/(Johannesburg|Maputo|Harare|Lusaka|Windhoek|Gaborone|Maseru|Mbabane|Antananarivo|Luanda|Lubumbashi|Blantyre|Dar_es_Salaam)|Asia\/(Jakarta|Makassar|Jayapura|Dili)|Indian\/(Mauritius|Reunion|Antananarivo))/;

export const getSeason = (date = new Date(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): Season => {
  const month = date.getMonth();
  const north: Season = month <= 1 || month === 11 ? "winter" : month <= 4 ? "spring" : month <= 7 ? "summer" : "autumn";
  if (!southern.test(timeZone)) return north;
  return ({ winter: "summer", spring: "autumn", summer: "winter", autumn: "spring" } as const)[north];
};

const moodScore: Record<MoodGrade, number> = {
  "A+": 4, A: 3.7, "A-": 3.4, "B+": 3.1, B: 2.8, "B-": 2.5, "C+": 2.2, C: 2, "C-": 1.7, "D+": 1.4, D: 1.1, "D-": 0.8, F: 0,
};

// Your last week of moods, newest first. Recent days count a little more.
export const getWeather = (moods: MoodGrade[]): Weather => {
  if (!moods.length) return "fair";
  let total = 0;
  let weights = 0;
  moods.slice(0, 7).forEach((mood, index) => {
    const weight = 1 - index * 0.08;
    total += moodScore[mood] * weight;
    weights += weight;
  });
  const score = total / weights;
  return score >= 3.1 ? "sunny" : score >= 2.3 ? "fair" : score >= 1.5 ? "cloudy" : "rain";
};

export type Atmosphere = { dayPart: DayPart; season: Season; weather: Weather };

export type AtmosphereLook = {
  // CSS colours for the sky behind the islands, top to bottom.
  sky: [string, string];
  hemisphere: { sky: string; ground: string; intensity: number };
  sun: { color: string; intensity: number };
};

const skies: Record<DayPart, Record<Weather, [string, string]>> = {
  dawn: { sunny: ["#ffd9c2", "#fff1dc"], fair: ["#f6d6cb", "#fbecdd"], cloudy: ["#d9cfd0", "#ece4dc"], rain: ["#bcc1c9", "#d8d9d6"] },
  day: { sunny: ["#bfe4ff", "#f3fbff"], fair: ["#d4ebf7", "#f7f8f1"], cloudy: ["#d3d9de", "#eceeea"], rain: ["#b4bfc8", "#d6dbdb"] },
  dusk: { sunny: ["#f7b48f", "#fde3c4"], fair: ["#e9b3a3", "#f6dfcd"], cloudy: ["#c9b8b8", "#e3d7cf"], rain: ["#a9aab6", "#ccc9c9"] },
  night: { sunny: ["#1d2a4d", "#3a4870"], fair: ["#1f2943", "#36425f"], cloudy: ["#262c3a", "#3b4150"], rain: ["#1f242e", "#333944"] },
};

export const getAtmosphereLook = ({ dayPart, weather, season }: Atmosphere): AtmosphereLook => {
  const dim = { sunny: 1.05, fair: 1, cloudy: 0.82, rain: 0.68 }[weather];
  const sunColor = { dawn: "#ffd2a8", day: "#fff8ec", dusk: "#ffb987", night: "#a9bdff" }[dayPart];
  const base = { dawn: 1.6, day: 2.1, dusk: 1.5, night: 0.55 }[dayPart];
  const hemisphereSky = season === "winter" && dayPart !== "night" ? "#eef3ff" : { dawn: "#ffe6cf", day: "#fff4dc", dusk: "#ffd9bd", night: "#7f8fc4" }[dayPart];
  return {
    sky: skies[dayPart][weather],
    hemisphere: {
      sky: hemisphereSky,
      ground: dayPart === "night" ? "#2c3a33" : "#5d7a4c",
      intensity: (dayPart === "night" ? 0.75 : 1.5) * (weather === "rain" ? 0.9 : 1),
    },
    sun: { color: sunColor, intensity: base * dim * (weather === "rain" ? 0.7 : 1) },
  };
};

export const describeAtmosphere = ({ dayPart, season, weather }: Atmosphere) =>
  `${{ sunny: "Sunny", fair: "Fair", cloudy: "Cloudy", rain: "Rainy" }[weather]} ${dayPart === "day" ? "day" : dayPart} in ${season}`;
