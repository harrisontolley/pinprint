import type { Place } from "./types";

// Showcase preset so the app opens populated and sellable. Home is New York (the
// US-focused default); destinations spread arrows around the whole compass
// (London ~NE, Bangkok/Tokyo ~NW great-circle, Miami ~S, Seattle ~NW) and
// exercise all four tie types in the legend.

export const SEED_HOME: Place = {
  id: "seed-nyc",
  label: "New York",
  fullName: "New York, New York, United States",
  lat: 40.7128,
  lng: -74.006,
  kind: "city",
  affiliation: "lived",
};

export const SEED_PLACES: Place[] = [
  {
    id: "seed-london",
    label: "London",
    fullName: "London, England, United Kingdom",
    lat: 51.5074,
    lng: -0.1278,
    kind: "city",
    affiliation: "visited",
  },
  {
    id: "seed-bangkok",
    label: "Bangkok",
    fullName: "Bangkok, Thailand",
    lat: 13.7563,
    lng: 100.5018,
    kind: "city",
    affiliation: "family",
  },
  {
    id: "seed-tokyo",
    label: "Tokyo",
    fullName: "Tokyo, Japan",
    lat: 35.6762,
    lng: 139.6503,
    kind: "city",
    affiliation: "visited",
  },
  {
    id: "seed-seattle",
    label: "Seattle",
    fullName: "Seattle, Washington, United States",
    lat: 47.6062,
    lng: -122.3321,
    kind: "city",
    affiliation: "lived",
  },
  {
    id: "seed-miami",
    label: "Miami",
    fullName: "Miami, Florida, United States",
    lat: 25.7617,
    lng: -80.1918,
    kind: "city",
    affiliation: "born",
  },
];
