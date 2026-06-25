import { addTrip, setActiveTripId, trips } from './trips.js';
import { addEvent } from './events.js';
import { exampleTrips } from './seeds.js';

const LOADED_KEY = 'tracker.exampleTripsLoaded';

const wasAlreadyLoaded = () => {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(LOADED_KEY) === '1';
  } catch {
    return false;
  }
};

const markLoaded = () => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOADED_KEY, '1');
  } catch {
    // ignore
  }
};

export const loadExampleTrips = () => {
  const examples = exampleTrips();
  const created = [];
  for (const spec of examples) {
    const { events = [], ...tripInput } = spec;
    const trip = addTrip(tripInput);
    for (const event of events) {
      addEvent({ ...event, tripId: trip.id });
    }
    created.push(trip);
  }
  if (created.length) {
    setActiveTripId(created[0].id);
  }
  markLoaded();
  return created;
};

export const areExamplesLoaded = () => {
  if (wasAlreadyLoaded()) return true;
  const names = new Set(trips.value.map((t) => t.name));
  return (
    names.has('Italy (2 weeks)') ||
    names.has('Iberic Peninsula (3 weeks)') ||
    names.has('Brazil (1 month — all regions)')
  );
};