// Curated example trips. Each event payload is fed through the same
// `sanitize` pipeline as user-entered data, so partial / malformed entries
// simply degrade gracefully.

const pad2 = (n) => String(n).padStart(2, '0');

const toDT = (date, time) => `${date}T${time}`;
const addDays = (date, days) => {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d));
  next.setUTCDate(next.getUTCDate() + days);
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
};

// Each event uses local times (no zone) — consistent with the rest of the app.
// `coords` is one of:
//   - { lng, lat }            → single place coords
//   - { from: [lng,lat], to: [lng,lat] } → commute from/to coords
const ev = (date, start, end, type, payload, coords) => {
  const out = {
    startDateTime: toDT(date, start),
    endDateTime: toDT(date, end),
    type,
    ...payload,
  };
  if (coords && Array.isArray(coords.from) && Array.isArray(coords.to)) {
    out.placeFromCoords = { lng: coords.from[0], lat: coords.from[1] };
    out.placeToCoords = { lng: coords.to[0], lat: coords.to[1] };
  } else if (coords && Number.isFinite(coords.lng) && Number.isFinite(coords.lat)) {
    out.placeCoords = { lng: coords.lng, lat: coords.lat };
  }
  return out;
};

const italy = (start) => {
  const d = (n) => addDays(start, n);
  return {
    name: 'Italy (2 weeks)',
    startDate: start,
    endDate: d(13),
    mapView: { lng: 12.5, lat: 41.9, zoom: 5.2, bearing: 0 },
    events: [
      // Day 0 — Arrive Naples
      ev(d(0), '10:00', '11:30', 'commute', {
        description: 'Flight from home → Naples (NAP)',
        placeFrom: 'Home airport',
        placeTo: 'Naples International Airport (NAP)',
        price: 220,
        currency: 'EUR',
        isPaid: false,
        links: [{ label: 'Flight search', url: 'https://www.google.com/flights' }],
      }, { from: [0, 0], to: [14.2906, 40.886] }),
      ev(d(0), '12:30', '13:30', 'commute', {
        description: 'Alibus from airport to city center',
        placeFrom: 'Naples International Airport (NAP)',
        placeTo: 'Naples Central Station',
        price: 5,
        currency: 'EUR',
      }, { from: [14.2906, 40.886], to: [14.2721, 40.853] }),
      ev(d(0), '13:45', '15:00', 'food', {
        description: 'Pizza lunch — traditional Neapolitan margherita',
        place: "Sorbillo (Via dei Tribunali)",
        price: 12,
        currency: 'EUR',
      }, { lng: 14.2525, lat: 40.8518 }),
      ev(d(0), '15:00', '17:30', 'activity', {
        description: 'Walking tour: Spaccanapoli & historic center',
        place: 'Spaccanapoli, Naples',
      }, { lng: 14.254, lat: 40.849 }),
      ev(d(0), '19:00', '21:00', 'food', {
        description: 'Dinner — seafood pasta & local wine',
        place: 'Trattoria da Nennella',
        price: 28,
        currency: 'EUR',
      }, { lng: 14.2503, lat: 40.8462 }),
      ev(d(0), '21:30', '22:30', 'accommodation', {
        description: 'Check-in: boutique B&B near Spaccanapoli',
        place: 'B&B Atmosfere del Centro',
        price: 95,
        currency: 'EUR',
      }, { lng: 14.2535, lat: 40.8497 }),

      // Day 1 — Naples: Pompeii + Vesuvius
      ev(d(1), '08:00', '09:00', 'food', {
        description: 'Breakfast — espresso + cornetto',
        place: 'Caffè Gambrinus',
        price: 5,
        currency: 'EUR',
      }, { lng: 14.2483, lat: 40.8384 }),
      ev(d(1), '09:15', '10:00', 'commute', {
        description: 'Circumvesuviana train to Pompeii',
        placeFrom: 'Naples Central Station',
        placeTo: 'Pompeii Scavi',
        price: 4,
        currency: 'EUR',
      }, { from: [14.2721, 40.853], to: [14.4892, 40.7488] }),
      ev(d(1), '10:00', '13:30', 'activity', {
        description: 'Sightseeing: Pompeii ruins (≈3h)',
        place: 'Parco Archeologico di Pompei',
        price: 18,
        currency: 'EUR',
      }, { lng: 14.4892, lat: 40.7488 }),
      ev(d(1), '14:00', '15:30', 'food', {
        description: 'Lunch near Pompeii entrance',
        place: 'Ristorante Suisse',
        price: 18,
        currency: 'EUR',
      }, { lng: 14.489, lat: 40.7495 }),
      ev(d(1), '15:45', '18:00', 'commute', {
        description: 'Bus to Mt. Vesuvius crater + return',
        placeFrom: 'Pompeii Scavi',
        placeTo: 'Mt. Vesuvius crater',
        price: 22,
        currency: 'EUR',
      }, { from: [14.4892, 40.7488], to: [14.4264, 40.8214] }),
      ev(d(1), '20:00', '21:30', 'food', {
        description: 'Dinner — Neapolitan street food crawl',
        place: 'Via Toledo, Naples',
        price: 15,
        currency: 'EUR',
      }, { lng: 14.249, lat: 40.841 }),

      // Day 2 — Naples to Rome (train)
      ev(d(2), '09:00', '10:00', 'food', {
        description: 'Breakfast at the B&B',
        price: 6,
        currency: 'EUR',
      }, { lng: 14.2535, lat: 40.8497 }),
      ev(d(2), '10:30', '11:35', 'commute', {
        description: 'Frecciarossa high-speed train NAP → ROM',
        placeFrom: 'Naples Central Station',
        placeTo: 'Roma Termini',
        price: 45,
        currency: 'EUR',
        isPaid: false,
        links: [{ label: 'Trenitalia', url: 'https://www.trenitalia.com' }],
      }, { from: [14.2721, 40.853], to: [12.5018, 41.9009] }),
      ev(d(2), '12:00', '12:45', 'food', {
        description: 'Lunch — carbonara near Termini',
        place: 'Roscioli Caffè',
        price: 16,
        currency: 'EUR',
      }, { lng: 12.4964, lat: 41.8955 }),
      ev(d(2), '13:00', '18:00', 'activity', {
        description: 'Walking: Colosseum, Roman Forum, Palatine Hill',
        place: 'Colosseum, Rome',
        price: 24,
        currency: 'EUR',
        links: [{ label: 'Tickets', url: 'https://www.coopculture.it' }],
      }, { lng: 12.4922, lat: 41.8902 }),
      ev(d(2), '20:00', '22:00', 'food', {
        description: 'Dinner — traditional Roman trattoria',
        place: 'Da Enzo al 29 (Trastevere)',
        price: 32,
        currency: 'EUR',
      }, { lng: 12.471, lat: 41.8897 }),

      // Day 3 — Rome: Vatican
      ev(d(3), '08:00', '08:45', 'food', {
        description: 'Breakfast + espresso',
        price: 5,
        currency: 'EUR',
      }, { lng: 12.471, lat: 41.8897 }),
      ev(d(3), '09:00', '13:00', 'activity', {
        description: 'Vatican Museums + Sistine Chapel',
        place: 'Vatican Museums',
        price: 25,
        currency: 'EUR',
      }, { lng: 12.4535, lat: 41.9065 }),
      ev(d(3), '13:15', '14:30', 'food', {
        description: 'Lunch in Prati',
        place: 'Osteria dell\'Angelo',
        price: 22,
        currency: 'EUR',
      }, { lng: 12.4585, lat: 41.9082 }),
      ev(d(3), '14:45', '17:00', 'activity', {
        description: "St. Peter's Basilica & dome climb",
        place: 'St. Peter\'s Basilica',
      }, { lng: 12.4514, lat: 41.9022 }),
      ev(d(3), '19:30', '21:30', 'food', {
        description: 'Dinner — pizza al taglio + gelato',
        place: 'Pizzarium Bonci',
        price: 14,
        currency: 'EUR',
      }, { lng: 12.4542, lat: 41.9089 }),

      // Day 4 — Rome: city walk
      ev(d(4), '09:00', '12:30', 'activity', {
        description: 'Walk: Pantheon, Trevi Fountain, Spanish Steps, Piazza Navona',
        place: 'Centro Storico, Rome',
      }, { lng: 12.4823, lat: 41.8986 }),
      ev(d(4), '13:00', '14:30', 'food', {
        description: 'Lunch — cacio e pepe',
        place: 'Piperno (Jewish Ghetto)',
        price: 25,
        currency: 'EUR',
      }, { lng: 12.4776, lat: 41.8937 }),
      ev(d(4), '15:00', '17:30', 'activity', {
        description: 'Borghese Gallery (booked slot)',
        place: 'Galleria Borghese',
        price: 20,
        currency: 'EUR',
      }, { lng: 12.4922, lat: 41.9143 }),
      ev(d(4), '20:00', '22:00', 'food', {
        description: 'Dinner — fine dining',
        place: 'Aroma Restaurant (Celio)',
        price: 90,
        currency: 'EUR',
        isPaid: false,
      }, { lng: 12.4976, lat: 41.8865 }),

      // Day 5 — Rome → Sicily
      ev(d(5), '07:00', '08:30', 'commute', {
        description: 'Flight Rome FCO → Catania CTA',
        placeFrom: 'Rome Fiumicino (FCO)',
        placeTo: 'Catania–Fontanarossa (CTA)',
        price: 70,
        currency: 'EUR',
        isPaid: false,
      }, { from: [12.2389, 41.8003], to: [15.0664, 37.4668] }),
      ev(d(5), '09:30', '11:00', 'commute', {
        description: 'Rental car pickup',
        placeFrom: 'Catania Airport',
        placeTo: 'Catania Centro',
        price: 45,
        currency: 'EUR',
      }, { from: [15.0664, 37.4668], to: [15.0873, 37.5079] }),
      ev(d(5), '12:00', '13:30', 'food', {
        description: 'Lunch — arancini & pasta alla Norma',
        place: 'Trattoria De Fiore',
        price: 18,
        currency: 'EUR',
      }, { lng: 15.0864, lat: 37.5024 }),
      ev(d(5), '14:00', '17:00', 'activity', {
        description: 'Catania old town & fish market',
        place: 'Piazza del Duomo, Catania',
      }, { lng: 15.0863, lat: 37.5025 }),
      ev(d(5), '17:30', '20:30', 'commute', {
        description: 'Drive Catania → Taormina',
        placeFrom: 'Catania',
        placeTo: 'Taormina',
      }, { from: [15.0873, 37.5079], to: [15.288, 37.8521] }),

      // Day 6 — Taormina
      ev(d(6), '09:30', '12:30', 'activity', {
        description: 'Ancient Theatre of Taormina + view of Etna',
        place: 'Teatro Antico di Taormina',
        price: 13,
        currency: 'EUR',
      }, { lng: 15.2924, lat: 37.8529 }),
      ev(d(6), '13:00', '14:30', 'food', {
        description: 'Lunch — granita + brioche, then pasta',
        place: 'Bam Bar + Ristorante Il Duomo',
        price: 20,
        currency: 'EUR',
      }, { lng: 15.2839, lat: 37.8519 }),
      ev(d(6), '15:00', '18:00', 'activity', {
        description: 'Walk Corso Umberto + Isola Bella beach',
        place: 'Isola Bella, Taormina',
      }, { lng: 15.3006, lat: 37.8517 }),
      ev(d(6), '20:00', '22:00', 'food', {
        description: 'Dinner — Sicilian seafood',
        place: 'Ristorante Al Saraceno',
        price: 45,
        currency: 'EUR',
      }, { lng: 15.2865, lat: 37.8522 }),

      // Day 7 — Etna
      ev(d(7), '08:00', '12:00', 'activity', {
        description: 'Mt. Etna guided tour (south side, 2000m)',
        place: 'Rifugio Sapienza, Etna',
        price: 55,
        currency: 'EUR',
      }, { lng: 14.9994, lat: 37.7009 }),
      ev(d(7), '13:00', '14:30', 'food', {
        description: 'Lunch at a winery on Etna slope',
        place: 'Tenuta San Michele',
        price: 28,
        currency: 'EUR',
      }, { lng: 15.032, lat: 37.732 }),
      ev(d(7), '19:00', '21:00', 'food', {
        description: 'Dinner — Etna DOC wine tasting',
        place: 'Osteria RossoDiVino',
        price: 38,
        currency: 'EUR',
      }, { lng: 15.286, lat: 37.851 }),

      // Day 8 — Syracuse
      ev(d(8), '09:00', '11:30', 'commute', {
        description: 'Drive Taormina → Syracuse',
        placeFrom: 'Taormina',
        placeTo: 'Syracuse',
      }, { from: [15.288, 37.8521], to: [15.2866, 37.0596] }),
      ev(d(8), '12:00', '13:30', 'food', {
        description: 'Lunch — seafood',
        place: 'Ristorante Don Camillo',
        price: 30,
        currency: 'EUR',
      }, { lng: 15.293, lat: 37.0636 }),
      ev(d(8), '14:00', '18:00', 'activity', {
        description: 'Syracuse archaeological park + Ortigia',
        place: 'Parco Archeologico della Neapolis',
        price: 14,
        currency: 'EUR',
      }, { lng: 15.2752, lat: 37.0641 }),

      // Day 9 — Palermo
      ev(d(9), '08:00', '10:30', 'commute', {
        description: 'Drive Syracuse → Palermo',
        placeFrom: 'Syracuse',
        placeTo: 'Palermo',
      }, { from: [15.2866, 37.0596], to: [13.3615, 38.1157] }),
      ev(d(9), '11:00', '13:00', 'activity', {
        description: 'Palermo Cathedral + Norman Palace',
        place: 'Cattedrale di Palermo',
        price: 10,
        currency: 'EUR',
      }, { lng: 13.3556, lat: 38.1143 }),
      ev(d(9), '13:30', '15:00', 'food', {
        description: 'Lunch — street food (panelle, arancine, spleen sandwich)',
        place: 'Ballarò Market',
        price: 12,
        currency: 'EUR',
      }, { lng: 13.3582, lat: 38.1097 }),
      ev(d(9), '15:30', '18:00', 'activity', {
        description: 'Teatro Massimo + Vucciria',
        place: 'Teatro Massimo',
        price: 8,
        currency: 'EUR',
      }, { lng: 13.3589, lat: 38.1198 }),
      ev(d(9), '20:00', '22:00', 'food', {
        description: 'Dinner — Sicilian fine dining',
        place: 'Bye Bye Blues',
        price: 65,
        currency: 'EUR',
      }, { lng: 13.3676, lat: 38.1306 }),

      // Day 10 — Cefalù
      ev(d(10), '09:00', '10:30', 'commute', {
        description: 'Train Palermo → Cefalù',
        placeFrom: 'Palermo Centrale',
        placeTo: 'Cefalù',
        price: 8,
        currency: 'EUR',
      }, { from: [13.367, 38.1076], to: [14.0147, 38.0396] }),
      ev(d(10), '11:00', '12:30', 'activity', {
        description: 'Cefalù Cathedral & old town',
        place: 'Duomo di Cefalù',
      }, { lng: 14.0226, lat: 38.0395 }),
      ev(d(10), '13:00', '14:30', 'food', {
        description: 'Lunch — fresh seafood by the sea',
        place: 'Ristorante La Brace',
        price: 28,
        currency: 'EUR',
      }, { lng: 14.0189, lat: 38.04 }),
      ev(d(10), '15:00', '18:00', 'activity', {
        description: 'Beach time at Lungomare',
        place: 'Lungomare di Cefalù',
      }, { lng: 14.018, lat: 38.0388 }),

      // Day 11 — Agrigento
      ev(d(11), '08:00', '10:00', 'commute', {
        description: 'Drive Cefalù → Agrigento',
        placeFrom: 'Cefalù',
        placeTo: 'Agrigento',
      }, { from: [14.0147, 38.0396], to: [13.5765, 37.3111] }),
      ev(d(11), '10:30', '13:30', 'activity', {
        description: 'Valley of the Temples',
        place: 'Valle dei Templi, Agrigento',
        price: 15,
        currency: 'EUR',
      }, { lng: 13.5912, lat: 37.2908 }),
      ev(d(11), '14:00', '15:30', 'food', {
        description: 'Lunch — countryside agriturismo',
        place: 'Agriturismo Passo dei Briganti',
        price: 22,
        currency: 'EUR',
      }, { lng: 13.6015, lat: 37.311 }),
      ev(d(11), '20:00', '22:00', 'food', {
        description: 'Dinner — local cous cous di pesce',
        place: 'Trattoria Concordia',
        price: 26,
        currency: 'EUR',
      }, { lng: 13.5758, lat: 37.3089 }),

      // Day 12 — Free day / relax
      ev(d(12), '10:00', '12:00', 'leisure', {
        description: 'Morning swim + spa',
        place: 'Hotel pool',
      }, { lng: 13.5765, lat: 37.3111 }),
      ev(d(12), '13:00', '14:30', 'food', {
        description: 'Long Sicilian lunch',
        place: 'Baglio Oneto Resort',
        price: 35,
        currency: 'EUR',
      }, { lng: 13.5153, lat: 37.7108 }),
      ev(d(12), '19:30', '22:00', 'food', {
        description: 'Farewell dinner — tasting menu',
        place: 'Ristorante La Madia (Sciacca)',
        price: 85,
        currency: 'EUR',
      }, { lng: 13.0886, lat: 37.5058 }),

      // Day 13 — Depart
      ev(d(13), '08:00', '10:00', 'commute', {
        description: 'Drive to Palermo airport',
        placeFrom: 'Agrigento',
        placeTo: 'Palermo Airport (PMO)',
      }, { from: [13.5765, 37.3111], to: [13.102, 38.176] }),
      ev(d(13), '12:00', '14:30', 'commute', {
        description: 'Flight Palermo → Home',
        placeFrom: 'Palermo (PMO)',
        placeTo: 'Home airport',
        price: 210,
        currency: 'EUR',
        isPaid: false,
      }, { from: [13.102, 38.176], to: [0, 0] }),
    ],
  };
};

const iberic = (start) => {
  const d = (n) => addDays(start, n);
  return {
    name: 'Iberic Peninsula (3 weeks)',
    startDate: start,
    endDate: d(20),
    mapView: { lng: -8.0, lat: 39.5, zoom: 5.0, bearing: 0 },
    events: [
      // Day 0 — Arrive Lisbon
      ev(d(0), '10:00', '12:30', 'commute', {
        description: 'Flight → Lisbon (LIS)',
        placeTo: 'Lisbon Humberto Delgado Airport (LIS)',
        price: 180,
        currency: 'EUR',
        isPaid: false,
      }, { from: [0, 0], to: [-9.1342, 38.7813] }),
      ev(d(0), '13:00', '13:45', 'commute', {
        description: 'Metro from airport to city center',
        placeFrom: 'Lisbon Airport',
        placeTo: 'Baixa, Lisbon',
        price: 2,
        currency: 'EUR',
      }, { from: [-9.1342, 38.7813], to: [-9.1393, 38.7082] }),
      ev(d(0), '14:00', '15:30', 'food', {
        description: 'Lunch — bacalhau à brás',
        place: 'Cervejaria Ramiro',
        price: 18,
        currency: 'EUR',
      }, { lng: -9.1433, lat: 38.7237 }),
      ev(d(0), '16:00', '19:00', 'activity', {
        description: 'Tram 28 ride + Alfama walking tour',
        place: 'Alfama, Lisbon',
        price: 3,
        currency: 'EUR',
      }, { lng: -9.1295, lat: 38.7115 }),
      ev(d(0), '20:00', '22:00', 'food', {
        description: 'Dinner — petiscos & vinho verde',
        place: 'Taberna da Rua das Flores',
        price: 25,
        currency: 'EUR',
      }, { lng: -9.1425, lat: 38.7105 }),

      // Day 1 — Lisbon
      ev(d(1), '09:00', '10:30', 'food', {
        description: 'Pastel de nata breakfast',
        place: 'Pastéis de Belém',
        price: 4,
        currency: 'EUR',
      }, { lng: -9.2030, lat: 38.6975 }),
      ev(d(1), '10:30', '12:30', 'activity', {
        description: 'Belém Tower + Jerónimos Monastery',
        place: 'Mosteiro dos Jerónimos',
        price: 12,
        currency: 'EUR',
      }, { lng: -9.2067, lat: 38.6979 }),
      ev(d(1), '13:00', '14:30', 'food', {
        description: 'Lunch — modern Portuguese',
        place: 'Belcanto (2★)',
        price: 110,
        currency: 'EUR',
        isPaid: false,
      }, { lng: -9.1486, lat: 38.7192 }),
      ev(d(1), '15:00', '18:00', 'activity', {
        description: 'LX Factory + Time Out Market stroll',
        place: 'Time Out Market',
      }, { lng: -9.1463, lat: 38.7068 }),
      ev(d(1), '20:00', '22:00', 'food', {
        description: 'Dinner — fado night',
        place: 'Clube de Fado (Alfama)',
        price: 45,
        currency: 'EUR',
      }, { lng: -9.1295, lat: 38.7115 }),

      // Day 2 — Sintra
      ev(d(2), '08:30', '09:30', 'commute', {
        description: 'Train Lisbon → Sintra',
        placeFrom: 'Rossio Station',
        placeTo: 'Sintra',
        price: 5,
        currency: 'EUR',
      }, { from: [-9.1425, 38.7137], to: [-9.3888, 38.8004] }),
      ev(d(2), '10:00', '12:30', 'activity', {
        description: 'Pena Palace (booked entry)',
        place: 'Pena Palace',
        price: 14,
        currency: 'EUR',
      }, { lng: -9.3906, lat: 38.7878 }),
      ev(d(2), '13:00', '14:30', 'food', {
        description: 'Lunch in Sintra village',
        place: 'Tascantiga',
        price: 22,
        currency: 'EUR',
      }, { lng: -9.3888, lat: 38.7975 }),
      ev(d(2), '15:00', '18:00', 'activity', {
        description: 'Quinta da Regaleira + Moorish Castle',
        place: 'Quinta da Regaleira',
        price: 11,
        currency: 'EUR',
      }, { lng: -9.3961, lat: 38.7963 }),
      ev(d(2), '19:30', '21:30', 'food', {
        description: 'Dinner back in Lisbon',
        place: 'Cervejaria Marisqueira',
        price: 32,
        currency: 'EUR',
      }, { lng: -9.1535, lat: 38.7242 }),

      // Day 3 — Porto
      ev(d(3), '08:00', '11:00', 'commute', {
        description: 'Train Lisbon → Porto (Alfa Pendular)',
        placeFrom: 'Lisboa Santa Apolónia',
        placeTo: 'Porto São Bento',
        price: 35,
        currency: 'EUR',
        isPaid: false,
      }, { from: [-9.1247, 38.7145], to: [-8.6101, 41.1457] }),
      ev(d(3), '12:00', '13:30', 'food', {
        description: 'Lunch — francesinha',
        place: 'Café Santiago',
        price: 14,
        currency: 'EUR',
      }, { lng: -8.6063, lat: 41.1467 }),
      ev(d(3), '14:00', '18:00', 'activity', {
        description: 'Ribeira walk + Livraria Lello + Clérigos Tower',
        place: 'Ribeira, Porto',
        price: 8,
        currency: 'EUR',
      }, { lng: -8.6131, lat: 41.1402 }),
      ev(d(3), '20:00', '22:00', 'food', {
        description: 'Dinner — port wine + petiscos',
        place: 'Vinum Restaurant & Wine Bar',
        price: 40,
        currency: 'EUR',
      }, { lng: -8.6158, lat: 41.1451 }),

      // Day 4 — Douro Valley
      ev(d(4), '08:00', '09:00', 'commute', {
        description: 'Train Porto → Pinhão',
        placeFrom: 'Porto São Bento',
        placeTo: 'Pinhão',
        price: 14,
        currency: 'EUR',
      }, { from: [-8.6101, 41.1457], to: [-7.5479, 41.1897] }),
      ev(d(4), '10:00', '13:00', 'activity', {
        description: 'Douro river cruise (1h)',
        place: 'Pinhão',
        price: 25,
        currency: 'EUR',
      }, { lng: -7.5479, lat: 41.1897 }),
      ev(d(4), '13:30', '15:00', 'food', {
        description: 'Lunch at a quinta',
        place: 'Quinta do Tedo',
        price: 35,
        currency: 'EUR',
      }, { lng: -7.5471, lat: 41.1879 }),
      ev(d(4), '15:30', '18:00', 'activity', {
        description: 'Wine tasting tour',
        place: 'Quinta do Crasto',
        price: 30,
        currency: 'EUR',
      }, { lng: -7.5306, lat: 41.1706 }),

      // Day 5 — Coimbra
      ev(d(5), '09:00', '11:00', 'commute', {
        description: 'Train Pinhão → Coimbra',
        placeFrom: 'Pinhão',
        placeTo: 'Coimbra',
        price: 18,
        currency: 'EUR',
      }, { from: [-7.5479, 41.1897], to: [-8.4292, 40.2113] }),
      ev(d(5), '12:00', '13:30', 'food', {
        description: 'Lunch — chanfana',
        place: 'Zé Manel dos Ossos',
        price: 15,
        currency: 'EUR',
      }, { lng: -8.4293, lat: 40.2097 }),
      ev(d(5), '14:00', '17:00', 'activity', {
        description: 'University of Coimbra & Joanina Library',
        place: 'Universidade de Coimbra',
        price: 12,
        currency: 'EUR',
      }, { lng: -8.4289, lat: 40.2078 }),

      // Day 6 — Travel to Spain (Lisbon → Madrid by plane or to Seville by bus)
      ev(d(6), '08:00', '10:30', 'commute', {
        description: 'Flight Lisbon → Seville',
        placeFrom: 'Lisbon (LIS)',
        placeTo: 'Seville (SVQ)',
        price: 65,
        currency: 'EUR',
        isPaid: false,
      }, { from: [-9.1342, 38.7813], to: [-5.8932, 37.4180] }),
      ev(d(6), '12:00', '13:30', 'food', {
        description: 'Lunch — salmorejo & ibérico',
        place: 'Casa Robles',
        price: 20,
        currency: 'EUR',
      }, { lng: -5.9939, lat: 37.3886 }),
      ev(d(6), '14:00', '18:00', 'activity', {
        description: 'Cathedral + Giralda + Alcázar',
        place: 'Real Alcázar, Seville',
        price: 14,
        currency: 'EUR',
      }, { lng: -5.9903, lat: 37.3833 }),
      ev(d(6), '20:00', '22:30', 'food', {
        description: 'Tapas crawl in Triana',
        place: 'Calle San Jacinto, Triana',
        price: 30,
        currency: 'EUR',
      }, { lng: -6.0050, lat: 37.3815 }),

      // Day 7 — Seville
      ev(d(7), '09:00', '10:00', 'food', {
        description: 'Breakfast — churros con chocolate',
        place: 'Bar El Comercio',
        price: 5,
        currency: 'EUR',
      }, { lng: -5.9925, lat: 37.3895 }),
      ev(d(7), '10:30', '13:00', 'activity', {
        description: 'Plaza de España & María Luisa Park',
        place: 'Plaza de España',
      }, { lng: -5.9869, lat: 37.3772 }),
      ev(d(7), '14:00', '15:30', 'food', {
        description: 'Lunch — arroz',
        place: 'Abades Triana',
        price: 28,
        currency: 'EUR',
      }, { lng: -5.9970, lat: 37.3822 }),
      ev(d(7), '20:00', '22:00', 'food', {
        description: 'Flamenco show + dinner',
        place: 'Tablao El Arenal',
        price: 65,
        currency: 'EUR',
        isPaid: false,
      }, { lng: -5.9897, lat: 37.3854 }),

      // Day 8 — Córdoba
      ev(d(8), '09:00', '10:30', 'commute', {
        description: 'High-speed train Seville → Córdoba',
        placeFrom: 'Santa Justa, Seville',
        placeTo: 'Córdoba Central',
        price: 20,
        currency: 'EUR',
      }, { from: [-5.9747, 37.3927], to: [-4.7944, 37.8882] }),
      ev(d(8), '11:00', '13:00', 'activity', {
        description: 'Mezquita-Catedral de Córdoba',
        place: 'Mezquita, Córdoba',
        price: 13,
        currency: 'EUR',
      }, { lng: -4.7794, lat: 37.8790 }),
      ev(d(8), '13:30', '15:00', 'food', {
        description: 'Lunch in the Jewish Quarter',
        place: 'Bodegas Campos',
        price: 25,
        currency: 'EUR',
      }, { lng: -4.7806, lat: 37.8785 }),
      ev(d(8), '15:30', '18:00', 'activity', {
        description: 'Patios of the Alcázar + walk the old town',
        place: 'Alcázar de los Reyes Cristianos',
        price: 7,
        currency: 'EUR',
      }, { lng: -4.7797, lat: 37.8739 }),

      // Day 9 — Granada
      ev(d(9), '08:30', '10:30', 'commute', {
        description: 'Bus Córdoba → Granada',
        placeFrom: 'Córdoba',
        placeTo: 'Granada',
        price: 16,
        currency: 'EUR',
      }, { from: [-4.7944, 37.8882], to: [-3.7038, 37.1773] }),
      ev(d(9), '11:30', '13:30', 'food', {
        description: 'Lunch — tapas with every drink',
        place: 'Bar Los Diamantes',
        price: 18,
        currency: 'EUR',
      }, { lng: -3.7058, lat: 37.1779 }),
      ev(d(9), '14:00', '18:00', 'activity', {
        description: 'Alhambra & Generalife gardens (timed entry)',
        place: 'Alhambra',
        price: 19,
        currency: 'EUR',
        isPaid: false,
        links: [{ label: 'Tickets', url: 'https://www.alhambra-patronato.es' }],
      }, { lng: -3.5901, lat: 37.1761 }),

      // Day 10 — Granada + drive to coast
      ev(d(10), '09:00', '11:00', 'activity', {
        description: 'Albaicín walk + Mirador San Nicolás',
        place: 'Albaicín, Granada',
      }, { lng: -3.6956, lat: 37.1808 }),
      ev(d(10), '12:00', '13:30', 'food', {
        description: 'Lunch — paella on the coast',
        place: 'Restaurante María de la O (Nerja)',
        price: 22,
        currency: 'EUR',
      }, { lng: -3.8761, lat: 36.7456 }),
      ev(d(10), '14:00', '15:30', 'commute', {
        description: 'Rental car pickup + drive Granada → Nerja',
        placeFrom: 'Granada',
        placeTo: 'Nerja',
        price: 40,
        currency: 'EUR',
      }, { from: [-3.7038, 37.1773], to: [-3.8761, 36.7456] }),

      // Day 11 — Nerja
      ev(d(11), '10:00', '12:00', 'activity', {
        description: 'Nerja Caves (Cuevas de Nerja)',
        place: 'Cuevas de Nerja',
        price: 12,
        currency: 'EUR',
      }, { lng: -3.8497, lat: 36.7613 }),
      ev(d(11), '13:00', '14:30', 'food', {
        description: 'Lunch — espetos (grilled sardines) on the beach',
        place: 'Chiringuito Ayo',
        price: 18,
        currency: 'EUR',
      }, { lng: -3.8708, lat: 36.7403 }),

      // Day 12 — Málaga
      ev(d(12), '09:00', '10:00', 'commute', {
        description: 'Drive Nerja → Málaga',
        placeFrom: 'Nerja',
        placeTo: 'Málaga',
      }, { from: [-3.8761, 36.7456], to: [-4.4214, 36.7213] }),
      ev(d(12), '10:30', '12:30', 'activity', {
        description: 'Picasso Museum',
        place: 'Museo Picasso',
        price: 12,
        currency: 'EUR',
      }, { lng: -4.4189, lat: 36.7220 }),
      ev(d(12), '13:00', '14:30', 'food', {
        description: 'Lunch — pescaíto frito',
        place: 'El Pimpi',
        price: 22,
        currency: 'EUR',
      }, { lng: -4.4186, lat: 36.7226 }),
      ev(d(12), '15:00', '17:00', 'activity', {
        description: 'Alcazaba + Roman Theatre',
        place: 'Alcazaba de Málaga',
        price: 5,
        currency: 'EUR',
      }, { lng: -4.4161, lat: 36.7204 }),
      ev(d(12), '20:00', '22:00', 'food', {
        description: 'Dinner at Muelle Uno',
        place: 'La Pérgola',
        price: 28,
        currency: 'EUR',
      }, { lng: -4.4147, lat: 36.7168 }),

      // Day 13 — Madrid (AVE train)
      ev(d(13), '08:00', '10:30', 'commute', {
        description: 'AVE Málaga → Madrid Atocha',
        placeFrom: 'Málaga María Zambrano',
        placeTo: 'Madrid Atocha',
        price: 60,
        currency: 'EUR',
        isPaid: false,
      }, { from: [-4.4328, 36.7138], to: [-3.6905, 40.4068] }),
      ev(d(13), '12:00', '13:30', 'food', {
        description: 'Lunch — cocido madrileño',
        place: 'La Bola',
        price: 25,
        currency: 'EUR',
      }, { lng: -3.7106, lat: 40.4203 }),
      ev(d(13), '14:00', '18:00', 'activity', {
        description: 'Museo del Prado',
        place: 'Museo del Prado',
        price: 15,
        currency: 'EUR',
      }, { lng: -3.6921, lat: 40.4138 }),
      ev(d(13), '20:00', '22:30', 'food', {
        description: 'Dinner — tapas at Mercado de San Miguel',
        place: 'Mercado de San Miguel',
        price: 30,
        currency: 'EUR',
      }, { lng: -3.7092, lat: 40.4154 }),

      // Day 14 — Madrid
      ev(d(14), '09:00', '10:00', 'food', {
        description: 'Breakfast — chocolate con churros',
        place: 'Chocolatería San Ginés',
        price: 7,
        currency: 'EUR',
      }, { lng: -3.7101, lat: 40.4170 }),
      ev(d(14), '10:30', '13:00', 'activity', {
        description: 'Royal Palace + Almudena Cathedral',
        place: 'Palacio Real',
        price: 12,
        currency: 'EUR',
      }, { lng: -3.7144, lat: 40.4180 }),
      ev(d(14), '13:30', '15:00', 'food', {
        description: 'Lunch in La Latina',
        place: 'Casa Lucio',
        price: 35,
        currency: 'EUR',
      }, { lng: -3.7107, lat: 40.4119 }),
      ev(d(14), '15:30', '18:00', 'activity', {
        description: 'Retiro Park + Reina Sofía Museum',
        place: 'Museo Reina Sofía',
        price: 12,
        currency: 'EUR',
      }, { lng: -3.6943, lat: 40.4081 }),

      // Day 15 — Toledo day trip
      ev(d(15), '08:00', '08:45', 'commute', {
        description: 'Train Madrid → Toledo',
        placeFrom: 'Madrid Atocha',
        placeTo: 'Toledo',
        price: 14,
        currency: 'EUR',
      }, { from: [-3.6905, 40.4068], to: [-4.0247, 39.8628] }),
      ev(d(15), '10:00', '12:30', 'activity', {
        description: 'Toledo Cathedral + Alcázar',
        place: 'Catedral de Toledo',
        price: 12,
        currency: 'EUR',
      }, { lng: -4.0240, lat: 39.8580 }),
      ev(d(15), '13:00', '14:30', 'food', {
        description: 'Lunch — carcamusas',
        place: 'El Alfilerito 24',
        price: 18,
        currency: 'EUR',
      }, { lng: -4.0236, lat: 39.8577 }),
      ev(d(15), '15:00', '18:00', 'activity', {
        description: 'El Greco Museum + Synagogue of Santa María la Blanca',
        place: 'Museo del Greco',
        price: 5,
        currency: 'EUR',
      }, { lng: -4.0297, lat: 39.8556 }),

      // Day 16 — Segovia / Ávila
      ev(d(16), '07:30', '09:00', 'commute', {
        description: 'Bus Madrid → Segovia',
        placeFrom: 'Madrid',
        placeTo: 'Segovia',
        price: 10,
        currency: 'EUR',
      }, { from: [-3.7038, 40.4168], to: [-4.1254, 40.9429] }),
      ev(d(16), '10:00', '12:30', 'activity', {
        description: 'Roman Aqueduct + Alcázar',
        place: 'Acueducto de Segovia',
        price: 8,
        currency: 'EUR',
      }, { lng: -4.1226, lat: 40.9480 }),
      ev(d(16), '13:00', '14:30', 'food', {
        description: 'Lunch — cochinillo asado',
        place: 'Mesón de Cándido',
        price: 35,
        currency: 'EUR',
      }, { lng: -4.1220, lat: 40.9507 }),

      // Day 17 — Bilbao
      ev(d(17), '09:00', '12:00', 'commute', {
        description: 'Flight Madrid → Bilbao',
        placeFrom: 'Madrid (MAD)',
        placeTo: 'Bilbao (BIO)',
        price: 55,
        currency: 'EUR',
        isPaid: false,
      }, { from: [-3.5676, 40.4983], to: [-2.9350, 43.3011] }),
      ev(d(17), '13:00', '14:30', 'food', {
        description: 'Lunch — pintxos in Casco Viejo',
        place: 'Bar Txirrinka',
        price: 22,
        currency: 'EUR',
      }, { lng: -2.9237, lat: 43.2597 }),
      ev(d(17), '15:00', '18:00', 'activity', {
        description: 'Guggenheim Museum',
        place: 'Museo Guggenheim',
        price: 16,
        currency: 'EUR',
        isPaid: false,
      }, { lng: -2.9347, lat: 43.2686 }),

      // Day 18 — San Sebastián
      ev(d(18), '09:00', '11:00', 'commute', {
        description: 'Bus Bilbao → San Sebastián',
        placeFrom: 'Bilbao',
        placeTo: 'San Sebastián',
        price: 12,
        currency: 'EUR',
      }, { from: [-2.9350, 43.3011], to: [-1.9812, 43.3183] }),
      ev(d(18), '12:00', '13:30', 'food', {
        description: 'Lunch pintxos crawl',
        place: 'Parte Vieja, San Sebastián',
        price: 25,
        currency: 'EUR',
      }, { lng: -1.9836, lat: 43.3245 }),
      ev(d(18), '14:00', '17:00', 'activity', {
        description: 'Walk La Concha + Monte Urgull',
        place: 'Playa de La Concha',
      }, { lng: -1.9914, lat: 43.3244 }),
      ev(d(18), '20:00', '22:30', 'food', {
        description: 'Dinner — Michelin tasting menu',
        place: 'Elkano (Getaria)',
        price: 95,
        currency: 'EUR',
        isPaid: false,
      }, { lng: -2.2047, lat: 43.3042 }),

      // Day 19 — Pamplona
      ev(d(19), '09:00', '11:30', 'commute', {
        description: 'Bus San Sebastián → Pamplona',
        placeFrom: 'San Sebastián',
        placeTo: 'Pamplona',
        price: 10,
        currency: 'EUR',
      }, { from: [-1.9812, 43.3183], to: [-1.6444, 42.8185] }),
      ev(d(19), '12:00', '13:30', 'food', {
        description: 'Lunch — menestra & txuletón',
        place: 'Casa Otano',
        price: 28,
        currency: 'EUR',
      }, { lng: -1.6454, lat: 42.8193 }),
      ev(d(19), '14:00', '17:00', 'activity', {
        description: 'Old town walk + Plaza del Castillo',
        place: 'Casco Viejo, Pamplona',
      }, { lng: -1.6426, lat: 42.8185 }),

      // Day 20 — Depart
      ev(d(20), '09:00', '11:00', 'commute', {
        description: 'Train Pamplona → Madrid',
        placeFrom: 'Pamplona',
        placeTo: 'Madrid',
        price: 30,
        currency: 'EUR',
      }, { from: [-1.6444, 42.8185], to: [-3.6905, 40.4068] }),
      ev(d(20), '14:00', '17:00', 'commute', {
        description: 'Flight Madrid → Home',
        placeFrom: 'Madrid Barajas (MAD)',
        price: 195,
        currency: 'EUR',
        isPaid: false,
      }, { from: [-3.5676, 40.4983], to: [0, 0] }),
    ],
  };
};

const brazil = (start) => {
  const d = (n) => addDays(start, n);
  return {
    name: 'Brazil (1 month — all regions)',
    startDate: start,
    endDate: d(29),
    mapView: { lng: -51.9253, lat: -14.235, zoom: 3.6, bearing: 0 },
    events: [
      // Week 1 — Southeast: Rio + São Paulo
      ev(d(0), '10:00', '12:30', 'commute', {
        description: 'Flight → Rio de Janeiro (GIG)',
        placeTo: 'Rio de Janeiro–Galeão (GIG)',
        price: 850,
        currency: 'USD',
        isPaid: false,
      }, { from: [0, 0], to: [-43.2506, -22.8090] }),
      ev(d(0), '13:30', '15:00', 'commute', {
        description: 'Airport transfer (Uber/99)',
        placeFrom: 'GIG Airport',
        placeTo: 'Copacabana, Rio',
        price: 18,
        currency: 'USD',
      }, { from: [-43.2506, -22.8090], to: [-43.1846, -22.9712] }),
      ev(d(0), '15:30', '16:30', 'food', {
        description: 'Lunch — feijoada',
        place: 'Cafecito (Lapa)',
        price: 14,
        currency: 'USD',
      }, { lng: -43.1766, lat: -22.9133 }),
      ev(d(0), '17:00', '20:00', 'activity', {
        description: 'Sunset at Arpoador + Copacabana walk',
        place: 'Arpoador, Rio de Janeiro',
      }, { lng: -43.1975, lat: -22.9875 }),
      ev(d(0), '20:30', '22:30', 'food', {
        description: 'Dinner — churrascaria rodízio',
        place: 'Fogo de Chão (Botafogo)',
        price: 45,
        currency: 'USD',
      }, { lng: -43.1843, lat: -22.9511 }),

      ev(d(1), '08:00', '09:00', 'food', {
        description: 'Breakfast — tapioca + açaí',
        place: 'Bibi Sucos',
        price: 8,
        currency: 'USD',
      }, { lng: -43.1858, lat: -22.9711 }),
      ev(d(1), '09:30', '13:00', 'activity', {
        description: 'Christ the Redeemer (Corcovado) + Paineiras',
        place: 'Cristo Redentor',
        price: 18,
        currency: 'USD',
      }, { lng: -43.2105, lat: -22.9519 }),
      ev(d(1), '13:30', '15:00', 'food', {
        description: 'Lunch — seafood',
        place: 'Marius Degustare (Lagoa)',
        price: 35,
        currency: 'USD',
      }, { lng: -43.2009, lat: -22.9707 }),
      ev(d(1), '15:30', '18:00', 'activity', {
        description: 'Sugarloaf Mountain cable car',
        place: 'Pão de Açúcar',
        price: 22,
        currency: 'USD',
      }, { lng: -43.1566, lat: -22.9486 }),

      ev(d(2), '09:00', '10:30', 'food', {
        description: 'Brunch at Feira de São Cristóvão',
        price: 12,
        currency: 'USD',
      }, { lng: -43.2216, lat: -22.8974 }),
      ev(d(2), '11:00', '17:00', 'activity', {
        description: 'Day trip: Petrópolis — Imperial Museum + Quitandinha',
        place: 'Petrópolis',
        price: 30,
        currency: 'USD',
        links: [{ label: 'Bus booking', url: 'https://www.clickbus.com.br' }],
      }, { lng: -43.1785, lat: -22.5050 }),

      ev(d(3), '08:00', '11:00', 'commute', {
        description: 'Bus Rio → Paraty',
        placeFrom: 'Rio Novo Rio Bus Station',
        placeTo: 'Paraty',
        price: 25,
        currency: 'USD',
      }, { from: [-43.2043, -22.9026], to: [-44.7131, -23.2228] }),
      ev(d(3), '12:00', '13:30', 'food', {
        description: 'Lunch — peixe assado',
        place: 'Restaurante Point da Graça',
        price: 18,
        currency: 'USD',
      }, { lng: -44.7144, lat: -23.2221 }),
      ev(d(3), '15:00', '18:00', 'activity', {
        description: 'Historic center walk + cachaça tasting',
        place: 'Centro Histórico de Paraty',
        price: 12,
        currency: 'USD',
      }, { lng: -44.7147, lat: -23.2193 }),

      ev(d(4), '09:00', '14:00', 'activity', {
        description: 'Boat tour — Saco do Mamanguá + beaches',
        place: 'Mamanguá, Paraty',
        price: 65,
        currency: 'USD',
      }, { lng: -44.6539, lat: -23.2711 }),
      ev(d(4), '15:00', '16:30', 'food', {
        description: 'Late lunch — moqueca caiçara',
        place: 'Thiago’s (Trindade)',
        price: 22,
        currency: 'USD',
      }, { lng: -44.5872, lat: -23.2625 }),

      ev(d(5), '07:00', '10:30', 'commute', {
        description: 'Bus Paraty → São Paulo',
        placeFrom: 'Paraty',
        placeTo: 'São Paulo Tietê',
        price: 28,
        currency: 'USD',
      }, { from: [-44.7131, -23.2228], to: [-46.6253, -23.5152] }),
      ev(d(5), '12:00', '13:30', 'food', {
        description: 'Lunch — Mercado Municipal (pastel de bacalhau)',
        place: 'Mercado Municipal de SP',
        price: 10,
        currency: 'USD',
      }, { lng: -46.6327, lat: -23.5475 }),
      ev(d(5), '14:00', '18:00', 'activity', {
        description: 'Avenida Paulista + MASP',
        place: 'MASP',
        price: 8,
        currency: 'USD',
      }, { lng: -46.6558, lat: -23.5614 }),
      ev(d(5), '20:00', '22:00', 'food', {
        description: 'Dinner — Japanese in Liberdade',
        place: 'Aizen Sushi',
        price: 32,
        currency: 'USD',
      }, { lng: -46.6356, lat: -23.5558 }),

      ev(d(6), '09:00', '10:30', 'food', {
        description: 'Coffee + pão de queijo',
        place: 'Padaria Bella Paulista',
        price: 6,
        currency: 'USD',
      }, { lng: -46.6572, lat: -23.5647 }),
      ev(d(6), '11:00', '15:00', 'activity', {
        description: 'Ibirapuera Park + MAM + Afro Brasil Museum',
        place: 'Parque Ibirapuera',
        price: 5,
        currency: 'USD',
      }, { lng: -46.6580, lat: -23.5870 }),
      ev(d(6), '20:00', '23:00', 'leisure', {
        description: 'Vila Madalena bars',
        place: 'Vila Madalena, São Paulo',
        price: 25,
        currency: 'USD',
      }, { lng: -46.6896, lat: -23.5557 }),

      // Week 2 — South: Foz do Iguaçu + Florianópolis
      ev(d(7), '09:00', '11:30', 'commute', {
        description: 'Flight São Paulo → Foz do Iguaçu (IGU)',
        placeFrom: 'São Paulo (GRU)',
        placeTo: 'Foz do Iguaçu (IGU)',
        price: 110,
        currency: 'USD',
        isPaid: false,
      }, { from: [-46.4731, -23.4356], to: [-54.4915, -25.5935] }),
      ev(d(7), '12:30', '14:00', 'food', {
        description: 'Lunch — churrasco paraguaio',
        place: 'Bufalo Branco (with Paraguayan side)',
        price: 20,
        currency: 'USD',
      }, { lng: -54.5078, lat: -25.5098 }),
      ev(d(7), '15:00', '19:00', 'activity', {
        description: 'Itaipu Dam panoramic visit',
        place: 'Itaipu Binacional',
        price: 15,
        currency: 'USD',
      }, { lng: -54.5886, lat: -25.4082 }),

      ev(d(8), '08:00', '17:00', 'activity', {
        description: 'Iguazu Falls (Argentine side, full day)',
        place: 'Cataratas del Iguazú',
        price: 35,
        currency: 'USD',
        links: [{ label: 'Tickets', url: 'https://www.argentina.gob.ar/parques-nacionales/iguazu' }],
      }, { lng: -54.4380, lat: -25.6953 }),

      ev(d(9), '08:00', '17:00', 'activity', {
        description: 'Iguazu Falls (Brazilian side) + bird park',
        place: 'Parque das Aves',
        price: 32,
        currency: 'USD',
      }, { lng: -54.4872, lat: -25.6105 }),

      ev(d(10), '10:00', '13:00', 'commute', {
        description: 'Flight Foz → Florianópolis (FLN)',
        placeFrom: 'Foz do Iguaçu (IGU)',
        placeTo: 'Florianópolis (FLN)',
        price: 95,
        currency: 'USD',
        isPaid: false,
      }, { from: [-54.4915, -25.5935], to: [-48.5531, -27.6706] }),
      ev(d(10), '14:00', '15:30', 'food', {
        description: 'Lunch — ostras e tainha',
        place: 'Ostradamus (Ribeirão da Ilha)',
        price: 18,
        currency: 'USD',
      }, { lng: -48.5825, lat: -27.7117 }),
      ev(d(10), '16:00', '19:00', 'leisure', {
        description: 'Praia Mole / Joaquina',
        place: 'Praia Mole, Florianópolis',
      }, { lng: -48.4226, lat: -27.6027 }),
      ev(d(10), '20:00', '22:00', 'food', {
        description: 'Dinner — sequência de camarão',
        place: 'Box 32 (Lagoa da Conceição)',
        price: 28,
        currency: 'USD',
      }, { lng: -48.4522, lat: -27.6108 }),

      ev(d(11), '09:00', '12:00', 'activity', {
        description: 'Car rental + drive to Beto Carrero World',
        place: 'Beto Carrero World',
        price: 60,
        currency: 'USD',
      }, { lng: -48.6519, lat: -26.7836 }),

      ev(d(12), '10:00', '17:00', 'leisure', {
        description: 'Praia do Rosa — whale watching (seasonal)',
        place: 'Praia do Rosa, Imbituba',
        price: 30,
        currency: 'USD',
      }, { lng: -48.6425, lat: -28.1225 }),

      ev(d(13), '09:00', '12:30', 'commute', {
        description: 'Flight Florianópolis → Porto Alegre',
        placeFrom: 'Florianópolis (FLN)',
        placeTo: 'Porto Alegre (POA)',
        price: 60,
        currency: 'USD',
        isPaid: false,
      }, { from: [-48.5531, -27.6706], to: [-51.1719, -29.9944] }),
      ev(d(13), '13:00', '14:30', 'food', {
        description: 'Lunch — chimarrão + carreteiro',
        place: 'Churrascaria Barranco',
        price: 18,
        currency: 'USD',
      }, { lng: -51.2189, lat: -30.0361 }),
      ev(d(13), '15:00', '18:00', 'activity', {
        description: 'Cidade Baixa + Mercado Público',
        place: 'Mercado Público de Porto Alegre',
      }, { lng: -51.2297, lat: -30.0276 }),

      // Week 3 — Center-West: Pantanal + Brasília
      ev(d(14), '09:00', '13:00', 'commute', {
        description: 'Flight Porto Alegre → Cuiabá (CGB)',
        placeFrom: 'Porto Alegre (POA)',
        placeTo: 'Cuiabá (CGB)',
        price: 130,
        currency: 'USD',
        isPaid: false,
      }, { from: [-51.1719, -29.9944], to: [-56.1167, -15.6526] }),
      ev(d(14), '14:00', '15:30', 'food', {
        description: 'Lunch — arroz com pequi',
        place: 'Getúlio Grill',
        price: 16,
        currency: 'USD',
      }, { lng: -56.0933, lat: -15.5972 }),
      ev(d(14), '16:00', '18:30', 'commute', {
        description: 'Drive Cuiabá → Pantanal (Porto Jofre)',
        placeFrom: 'Cuiabá',
        placeTo: 'Porto Jofre',
        price: 80,
        currency: 'USD',
      }, { from: [-56.0962, -15.5989], to: [-56.7761, -17.3578] }),

      ev(d(15), '06:00', '11:00', 'activity', {
        description: 'Jaguar safari — river boat',
        place: 'Rio Cuiabá',
        price: 120,
        currency: 'USD',
      }, { lng: -56.7761, lat: -17.3578 }),
      ev(d(15), '12:00', '13:30', 'food', {
        description: 'Lunch at the lodge',
        place: 'Pantanal Mato Grosso Hotel',
        price: 18,
        currency: 'USD',
      }, { lng: -56.7761, lat: -17.3578 }),
      ev(d(15), '15:30', '18:30', 'activity', {
        description: 'Caiman + capybara sunset tour',
        place: 'Transpantaneira',
        price: 70,
        currency: 'USD',
      }, { lng: -56.6500, lat: -17.1850 }),

      ev(d(16), '06:00', '11:00', 'activity', {
        description: 'Morning hike — giant otters + tapirs',
        place: 'Pantanal Matogrossense National Park',
        price: 90,
        currency: 'USD',
      }, { lng: -57.4500, lat: -17.7000 }),

      ev(d(17), '08:00', '13:00', 'commute', {
        description: 'Drive back to Cuiabá + flight to Brasília',
        placeFrom: 'Porto Jofre',
        placeTo: 'Brasília (BSB)',
        price: 140,
        currency: 'USD',
        isPaid: false,
      }, { from: [-56.7761, -17.3578], to: [-47.9185, -15.8710] }),
      ev(d(17), '14:00', '15:30', 'food', {
        description: 'Lunch — comida do cerrado',
        place: 'Restaurante Tempero da Dadá',
        price: 14,
        currency: 'USD',
      }, { lng: -47.9094, lat: -15.8233 }),
      ev(d(17), '16:00', '19:00', 'activity', {
        description: 'Esplanada dos Ministérios + Congresso',
        place: 'Congresso Nacional',
      }, { lng: -47.8647, lat: -15.7996 }),

      ev(d(18), '09:00', '12:00', 'activity', {
        description: 'Catedral Metropolitana + JK Memorial',
        place: 'Catedral de Brasília',
        price: 6,
        currency: 'USD',
      }, { lng: -47.8756, lat: -15.8333 }),
      ev(d(18), '12:30', '14:00', 'food', {
        description: 'Lunch in Asa Sul',
        place: 'Armazém do Mineiro',
        price: 16,
        currency: 'USD',
      }, { lng: -47.9226, lat: -15.8245 }),
      ev(d(18), '15:00', '18:00', 'activity', {
        description: 'Inhotim-style art: Santuário Dom Bosco + Parque da Cidade',
        place: 'Parque da Cidade Sarah Kubitschek',
      }, { lng: -47.9474, lat: -15.8417 }),

      // Week 4 — North: Manaus + Amazon + Belém + Northeast: Salvador + Recife
      ev(d(19), '08:00', '12:00', 'commute', {
        description: 'Flight Brasília → Manaus (MAO)',
        placeFrom: 'Brasília (BSB)',
        placeTo: 'Manaus (MAO)',
        price: 120,
        currency: 'USD',
        isPaid: false,
      }, { from: [-47.9185, -15.8710], to: [-60.0497, -3.0386] }),
      ev(d(19), '13:00', '14:30', 'food', {
        description: 'Lunch — tambaqui assado',
        place: 'Cairu Açaí & Peixes',
        price: 18,
        currency: 'USD',
      }, { lng: -60.0250, lat: -3.1325 }),
      ev(d(19), '15:00', '18:00', 'activity', {
        description: 'Teatro Amazonas + Centro Histórico',
        place: 'Teatro Amazonas',
        price: 8,
        currency: 'USD',
      }, { lng: -60.0249, lat: -3.1303 }),

      ev(d(20), '08:00', '11:00', 'commute', {
        description: 'Speedboat to jungle lodge',
        placeFrom: 'Porto de Manaus',
        placeTo: 'Rio Negro Jungle Lodge',
        price: 45,
        currency: 'USD',
      }, { from: [-60.0297, -3.1437], to: [-60.1906, -2.7250] }),
      ev(d(20), '12:00', '13:30', 'food', {
        description: 'Lunch at the lodge',
        place: 'Amazon Eco Lodge',
        price: 14,
        currency: 'USD',
      }, { lng: -60.1906, lat: -2.7250 }),
      ev(d(20), '15:00', '18:00', 'activity', {
        description: 'Anavilhanas archipelago canoeing',
        place: 'Anavilhanas',
        price: 60,
        currency: 'USD',
      }, { lng: -60.1294, lat: -2.5667 }),

      ev(d(21), '06:00', '09:00', 'activity', {
        description: 'Dawn birdwatching + pink dolphins',
        place: 'Rio Negro',
      }, { lng: -60.1906, lat: -2.7250 }),
      ev(d(21), '10:00', '12:00', 'activity', {
        description: 'Jungle hike — medicinal plants',
        place: 'Amazon rainforest',
      }, { lng: -60.1906, lat: -2.7250 }),
      ev(d(21), '15:00', '18:00', 'activity', {
        description: 'Piranha fishing at sunset',
        place: 'Igapó flooded forest',
        price: 25,
        currency: 'USD',
      }, { lng: -60.1906, lat: -2.7250 }),

      ev(d(22), '09:00', '12:00', 'activity', {
        description: 'Visit a Caboclo community',
        place: 'Rio Cuieiras',
      }, { lng: -60.4500, lat: -2.8300 }),
      ev(d(22), '14:00', '17:00', 'commute', {
        description: 'Return to Manaus',
        placeFrom: 'Jungle Lodge',
        placeTo: 'Manaus',
      }, { from: [-60.1906, -2.7250], to: [-60.0266, -3.1019] }),

      ev(d(23), '10:00', '13:00', 'commute', {
        description: 'Flight Manaus → Belém (BEL)',
        placeFrom: 'Manaus (MAO)',
        placeTo: 'Belém (BEL)',
        price: 110,
        currency: 'USD',
        isPaid: false,
      }, { from: [-60.0497, -3.0386], to: [-48.4764, -1.3792] }),
      ev(d(23), '14:00', '15:30', 'food', {
        description: 'Lunch — pato no tucupi + açaí na tigela',
        place: 'Casarão do Ver-o-Peso',
        price: 14,
        currency: 'USD',
      }, { lng: -48.5046, lat: -1.4529 }),
      ev(d(23), '16:00', '19:00', 'activity', {
        description: 'Mercado Ver-o-Peso + Estação das Docas',
        place: 'Ver-o-Peso, Belém',
      }, { lng: -48.5031, lat: -1.4536 }),

      ev(d(24), '09:00', '13:00', 'activity', {
        description: 'Day trip: Marajó Island — buffalo + beach',
        place: 'Marajó Island',
        price: 55,
        currency: 'USD',
      }, { lng: -49.5, lat: -0.9667 }),

      ev(d(25), '10:00', '14:00', 'commute', {
        description: 'Flight Belém → Salvador (SSA)',
        placeFrom: 'Belém (BEL)',
        placeTo: 'Salvador (SSA)',
        price: 130,
        currency: 'USD',
        isPaid: false,
      }, { from: [-48.4764, -1.3792], to: [-38.3306, -12.9111] }),
      ev(d(25), '15:00', '16:30', 'food', {
        description: 'Lunch — acarajé',
        place: 'Dona Mariquita (Pelourinho)',
        price: 8,
        currency: 'USD',
      }, { lng: -38.5126, lat: -12.9736 }),
      ev(d(25), '17:00', '20:00', 'activity', {
        description: 'Pelourinho walk + São Francisco Church',
        place: 'Pelourinho, Salvador',
        price: 6,
        currency: 'USD',
      }, { lng: -38.5126, lat: -12.9731 }),

      ev(d(26), '10:00', '12:00', 'food', {
        description: 'Brunch at Mercado Modelo',
        price: 12,
        currency: 'USD',
      }, { lng: -38.5136, lat: -12.9772 }),
      ev(d(26), '12:30', '14:00', 'activity', {
        description: 'Elevador Lacerda + Cidade Baixa',
        place: 'Elevador Lacerda',
      }, { lng: -38.5178, lat: -12.9744 }),
      ev(d(26), '15:00', '18:00', 'leisure', {
        description: 'Porto da Barra beach',
        place: 'Praia do Porto da Barra',
      }, { lng: -38.5178, lat: -13.0008 }),
      ev(d(26), '20:00', '22:30', 'food', {
        description: 'Dinner + Olodum show',
        place: 'Casa do Benin',
        price: 32,
        currency: 'USD',
      }, { lng: -38.5119, lat: -12.9742 }),

      ev(d(27), '10:00', '13:00', 'commute', {
        description: 'Flight Salvador → Recife (REC)',
        placeFrom: 'Salvador (SSA)',
        placeTo: 'Recife (REC)',
        price: 75,
        currency: 'USD',
        isPaid: false,
      }, { from: [-38.3306, -12.9111], to: [-34.9232, -8.1248] }),
      ev(d(27), '14:00', '15:30', 'food', {
        description: 'Lunch — caldinho + tapioca',
        place: 'Casa da Sogra',
        price: 12,
        currency: 'USD',
      }, { lng: -34.8770, lat: -8.0631 }),
      ev(d(27), '16:00', '19:00', 'activity', {
        description: 'Recife Antigo + Oficina Francisco Brennand',
        place: 'Oficina Cerâmica Francisco Brennand',
        price: 10,
        currency: 'USD',
      }, { lng: -34.9633, lat: -8.0422 }),

      ev(d(28), '09:00', '12:00', 'commute', {
        description: 'Day trip to Olinda',
        placeFrom: 'Recife',
        placeTo: 'Olinda',
        price: 6,
        currency: 'USD',
      }, { from: [-34.8770, -8.0476], to: [-34.8553, -8.0089] }),
      ev(d(28), '13:00', '14:30', 'food', {
        description: 'Lunch — peixe na telha',
        place: 'Oficina do Sabor',
        price: 18,
        currency: 'USD',
      }, { lng: -34.8553, lat: -8.0089 }),
      ev(d(28), '20:00', '22:00', 'food', {
        description: 'Farewell dinner',
        place: 'Mocotó (São Cristóvão)',
        price: 30,
        currency: 'USD',
      }, { lng: -34.9089, lat: -8.0439 }),

      // Day 29 — Depart
      ev(d(29), '10:00', '13:00', 'commute', {
        description: 'Flight Recife → Home (via GRU)',
        placeFrom: 'Recife (REC)',
        price: 950,
        currency: 'USD',
        isPaid: false,
      }, { from: [-34.9232, -8.1248], to: [0, 0] }),
    ],
  };
};

const bariloche = (start) => {
  const d = (n) => addDays(start, n);
  const item = (date, time, description, place, price, links = [], type = 'activity') => ({
    type,
    description,
    place,
    startDateTime: `${date}T${time}`,
    endDateTime: `${date}T${time === '09:00' ? '17:00' : '10:00'}`,
    price,
    currency: 'ARS',
    links,
  });
  const brlItem = (date, start, end, description, place, price, type = 'other', links = []) => ({
    type,
    description,
    place,
    startDateTime: `${date}T${start}`,
    endDateTime: `${date}T${end}`,
    price,
    currency: 'BRL',
    links,
  });
  const catedral = [
    item(d(0), '09:00', 'Snowboard day 1 — lift pass', 'Cerro Catedral', 160000, [{ label: 'Official rates', url: 'https://catedralaltapatagonia.com/tarifas/' }]),
    item(d(0), '08:00', 'Snowboard rental day 1 — estimated from official package pricing', 'Cerro Catedral', 80000),
    item(d(0), '10:00', 'Snowboard class day 1 — estimated; confirm at checkout', 'Cerro Catedral', 80000),
    item(d(1), '09:00', 'Snowboard day 2 — lift pass', 'Cerro Catedral', 160000),
    item(d(1), '08:00', 'Snowboard rental day 2 — estimated from official package pricing', 'Cerro Catedral', 80000),
    item(d(2), '09:00', 'Snowboard day 3 — lift pass', 'Cerro Catedral', 160000),
    item(d(2), '08:00', 'Snowboard rental day 3 — estimated from official package pricing', 'Cerro Catedral', 80000),
  ];
  const bayo = [
    item(d(0), '09:00', 'Snowboard day 1 — lift pass', 'Cerro Bayo', 136500, [{ label: 'Official rates', url: 'https://www.cerrobayo.com/tarifas/' }]),
    item(d(0), '08:00', 'Snowboard rental day 1 — Yeti full equipment', 'Cerro Bayo', 122500, [{ label: 'Official rental rates', url: 'https://www.cerrobayo.com/tarifas/rental-equipos.php' }]),
    item(d(0), '10:00', 'Snowboard class day 1 — group class allocation', 'Cerro Bayo', 100967, [{ label: 'Official school rates', url: 'https://www.cerrobayo.com/tarifas/escuela-combinada.php' }]),
    item(d(1), '09:00', 'Snowboard day 2 — lift pass', 'Cerro Bayo', 136500),
    item(d(1), '08:00', 'Snowboard rental day 2 — Yeti full equipment', 'Cerro Bayo', 122500),
    item(d(2), '09:00', 'Snowboard day 3 — lift pass', 'Cerro Bayo', 136500),
    item(d(2), '08:00', 'Snowboard rental day 3 — Yeti full equipment', 'Cerro Bayo', 122500),
  ];
  const lago = [
    item(d(0), '09:00', 'Ski day 1 — lift pass', 'Lago Hermoso', 89000, [{ label: 'Official rates', url: 'https://www.lagohermoso.com.ar/invierno-2/tarifas' }]),
    item(d(0), '08:00', 'Ski rental day 1 — estimated from 3-day pack difference', 'Lago Hermoso', 33333),
    item(d(0), '10:00', 'Ski class day 1 — 2 h initiation class, estimated from pack', 'Lago Hermoso', 66667),
    item(d(1), '09:00', 'Ski day 2 — lift pass', 'Lago Hermoso', 89000),
    item(d(1), '08:00', 'Ski rental day 2 — estimated from 3-day pack difference', 'Lago Hermoso', 33333),
    item(d(2), '09:00', 'Ski day 3 — lift pass', 'Lago Hermoso', 89000),
    item(d(2), '08:00', 'Ski rental day 3 — estimated from 3-day pack difference', 'Lago Hermoso', 33334),
  ];
  return {
    name: 'Bariloche & Villa La Angostura',
    startDate: start,
    endDate: d(7),
    mapView: { lng: -71.55, lat: -40.85, zoom: 8, bearing: 0 },
    comparisons: [
      {
        name: 'Snowboard and ski resorts',
        plans: [
          { name: 'Cerro Catedral — 3 days', items: catedral },
          { name: 'Cerro Bayo — 3 days', items: bayo },
          { name: 'Lago Hermoso — 3 days', items: lago },
        ],
      },
    ],
    events: [
      brlItem(d(0), '08:00', '10:00', 'Arrive at airport and pick up rental car', 'Bariloche Airport (BRC)', 1800, 'commute'),
      brlItem(d(0), '18:00', '19:00', 'Bariloche stay', 'Bariloche accommodation', 1500, 'accommodation'),
      brlItem(d(0), '20:00', '22:00', 'Vegetarian dinner', 'Ren Vegetariano, Bariloche', null, 'food', [{ label: 'Restaurant details', url: 'https://www.tripadvisor.com/Restaurant_Review-g312848-d6678521-Reviews-Ren_Vegetariano-San_Carlos_de_Bariloche_Province_of_Rio_Negro_Patagonia.html' }]),
      brlItem(d(1), '09:00', '14:00', 'Circuito Chico', 'Circuito Chico, Bariloche', 0, 'activity'),
      brlItem(d(1), '14:00', '15:30', 'Vegetarian lunch', 'Restaurante Punto Panorámico, Bariloche', null, 'food', [{ label: 'Restaurant details', url: 'https://www.tripadvisor.com/Restaurant_Review-g312848-d2388398-Reviews-Restaurant_Punto_Panoramico-San_Carlos_de_Bariloche_Province_of_Rio_Negro_Patagonia.html' }]),
      brlItem(d(1), '20:00', '22:00', 'Vegetarian dinner', 'Quiven Patagonia House Kitchen, Bariloche', null, 'food', [{ label: 'Restaurant details', url: 'https://www.tripadvisor.com/Restaurant_Review-g312848-d14024385-Reviews-Quiven_Patagonia_House_Kitchen-San_Carlos_de_Bariloche_Province_of_Rio_Negro_Patagonia.html' }]),
      brlItem(d(2), '09:00', '14:00', 'Cascada Los Alerces', 'Cascada Los Alerces, Bariloche', 0, 'activity'),
      brlItem(d(2), '14:00', '15:30', 'Vegetarian lunch', 'Almacén de Sabores, Bariloche', null, 'food', [{ label: 'Restaurant details', url: 'https://www.tripadvisor.com/Restaurant_Review-g312848-d2012566-Reviews-Almazen_de_Sabores-San_Carlos_de_Bariloche_Province_of_Rio_Negro_Patagonia.html' }]),
      brlItem(d(3), '14:00', '18:00', 'Drive Ruta de los 7 Lagos to Villa La Angostura', 'Ruta de los 7 Lagos', null, 'commute'),
      brlItem(d(3), '18:00', '19:00', 'Villa La Angostura stay', 'Villa La Angostura accommodation', 1800, 'accommodation'),
      brlItem(d(3), '20:00', '22:00', 'Vegetarian dinner', "Pistach', Villa La Angostura", null, 'food', [{ label: 'Restaurant details', url: 'https://www.tripadvisor.com/Restaurant_Review-g312844-d7597555-Reviews-Pistach-Villa_La_Angostura_Province_of_Neuquen_Patagonia.html' }]),
      brlItem(d(4), '13:00', '14:30', 'Vegetarian lunch', 'Nanuko Cervecería, Villa La Angostura', null, 'food', [{ label: 'Restaurant details', url: 'https://www.tripadvisor.com/Restaurant_Review-g312844-d2640310-Reviews-Nanuko_Cerveceria-Villa_La_Angostura_Province_of_Neuquen_Patagonia.html' }]),
      brlItem(d(4), '20:00', '22:00', 'Vegetarian dinner', 'Tinto Bistro, Villa La Angostura', null, 'food', [{ label: 'Restaurant details', url: 'https://www.tripadvisor.com/Restaurant_Review-g312844-d1412962-Reviews-Tinto_Bistro-Villa_La_Angostura_Province_of_Neuquen_Patagonia.html' }]),
      brlItem(d(5), '13:00', '14:30', 'Vegetarian lunch', 'La Crepe, Villa La Angostura', null, 'food', [{ label: 'Restaurant details', url: 'https://www.tripadvisor.com/Restaurant_Review-g312844-d11644559-Reviews-La_Crepe-Villa_La_Angostura_Province_of_Neuquen_Patagonia.html' }]),
      brlItem(d(5), '20:00', '22:00', 'Vegetarian dinner', 'Waldhaus Cocina del Bosque, Villa La Angostura', null, 'food', [{ label: 'Restaurant details', url: 'https://www.tripadvisor.com/Restaurant_Review-g312844-d1205867-Reviews-Waldhaus_Cocina_del_Bosque-Villa_La_Angostura_Province_of_Neuquen_Patagonia.html' }]),
      brlItem(d(6), '13:00', '14:30', 'Vegetarian lunch', 'Vientos Verdes, Villa La Angostura', null, 'food', [{ label: 'Restaurant details', url: 'https://www.tripadvisor.com/Restaurant_Review-g312844-d4233123-Reviews-Vientos_Verdes-Villa_La_Angostura_Province_of_Neuquen_Patagonia.html' }]),
      brlItem(d(6), '20:00', '22:00', 'Vegetarian dinner', 'Ay Ay Ay María, Villa La Angostura', null, 'food', [{ label: 'Restaurant details', url: 'https://www.tripadvisor.com/Restaurant_Review-g312844-d3171513-Reviews-Ay_Ay_Ay_Maria-Villa_La_Angostura_Province_of_Neuquen_Patagonia.html' }]),
      brlItem(d(7), '09:00', '12:00', 'To airport', 'Bariloche Airport (BRC)', null, 'commute'),
    ],
  };
};
// Anchor the example trips far in the future so they don't collide with the
// user's actual plans, but recent enough that the calendar is still relevant.
const seedStart = () => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() + 2, 1);
  return `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`;
};

export const exampleTrips = () => [
  italy(seedStart()),
  iberic(addDays(seedStart(), 14)),
  brazil(addDays(seedStart(), 35)),
  bariloche(addDays(seedStart(), 65)),
];
