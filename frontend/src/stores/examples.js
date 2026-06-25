import { addTrip, setActiveTripId, trips } from './trips.js';
import { addEvent } from './events.js';
import { exampleTrips } from './seeds.js';

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
  return created;
};
