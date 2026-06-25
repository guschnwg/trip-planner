const STORAGE_KEY = 'tracker.locale';

const messages = {
  en: {
    app: {
      trip: 'Trip',
      switchTrip: 'Switch',
      noTrip: 'No trip',
      startDate: 'Start date',
      endDate: 'End date',
      dateError: 'End date must be on or after start date.',
      view: {
        day: 'Day',
        allDays: 'All days',
      },
    },
    cost: {
      total: 'Total',
      paid: 'Paid',
      pending: 'To pay',
      free: 'Free',
      tooltip:
        'Prices shown here may not be accurate. Tap each item to confirm the latest amount.',
    },
    language: {
      label: 'Language',
      en: 'English',
      pt: 'Português',
      es: 'Español',
    },
    eventSheet: {
      newTitle: 'New event',
      editTitle: 'Edit event',
      hint: 'Type to search for a place, or use "Pick on map" to click a location.',
      fields: {
        type: 'Type',
        start: 'Start',
        end: 'End',
        description: 'Description',
        place: 'Place',
        placeFrom: 'Place from',
        placeTo: 'Place to',
        price: 'Price',
        links: 'Links',
      },
      actions: {
        pickOnMap: 'Pick on map',
        clickOnMap: 'Click on map…',
        existing: 'Existing',
        searchOrigin: 'Search origin…',
        searchDestination: 'Search destination…',
        searchPlace: 'Search a place…',
        addLink: '+ Add link',
        noLinks: 'No links.',
        linkLabel: 'Label',
        linkUrl: 'https://…',
        cancel: 'Cancel',
        save: 'Save',
        addEvent: 'Add event',
        delete: 'Delete',
        close: 'Close',
        clearOrigin: 'Clear origin',
        clearDestination: 'Clear destination',
        clearPlace: 'Clear place',
        removeLink: 'Remove link',
      },
      paid: {
        paid: 'Paid',
        planned: 'Planned',
      },
      errors: {
        endBeforeStart: 'End must be after start.',
        commuteNeedsPlace: 'Pick at least a from or to place for the commute.',
        placeNeedsCoords: 'Place is set but has no coordinates. Click the pick button to choose a location on the map.',
        searchFailed: 'Search failed.',
        noResults: 'No results.',
        searching: 'Searching…',
      },
      existing: {
        reuseTitle: 'Reuse a place already used in this trip',
        noSaved: 'No saved places yet',
      },
    },
    eventTypes: {
      commute: 'Commute',
      sleep: 'Sleep',
      food: 'Food',
      activity: 'Activity',
      work: 'Work',
      leisure: 'Leisure',
      accommodation: 'Accommodation',
      other: 'Other',
    },
    event: {
      at: 'at',
      free: 'free',
      paid: 'paid',
      planned: 'planned',
      arrow: '→',
      unknown: '?',
    },
    calendar: {
      previousDay: 'Previous day',
      nextDay: 'Next day',
      dayCount: '{index} of {total}',
      resizeStart: 'Resize start time',
      resizeEnd: 'Resize end time',
      empty: 'Select a trip with at least one day to see the calendar.',
    },
    tripModal: {
      titleSelect: 'Your trips',
      titleCreate: 'New trip',
      titleEdit: 'Edit trip',
      empty: 'No trips yet. Create your first one.',
      fields: {
        name: 'Name',
        startDate: 'Start date',
        endDate: 'End date',
      },
      namePlaceholder: 'Tokyo 2026, Summer road trip…',
      actions: {
        newTrip: 'New trip',
        cancel: 'Cancel',
        save: 'Save',
        createTrip: 'Create trip',
        close: 'Close',
        edit: 'Edit',
        delete: 'Delete',
        loadExamples: 'Load examples',
      },
      errors: {
        nameRequired: 'Name is required.',
        datesRequired: 'Start and end dates are required.',
        endBeforeStart: 'End date must be on or after start date.',
      },
      deleteConfirm: 'Delete trip "{name}"? Its events will remain in storage but become orphaned.',
      examplesConfirm: 'Add 3 example trips (Italy, Iberic Peninsula, Brazil) with sample events?',
      rangeSeparator: '→',
    },
  },
  pt: {
    app: {
      trip: 'Viagem',
      switchTrip: 'Trocar',
      noTrip: 'Sem viagem',
      startDate: 'Data de início',
      endDate: 'Data de fim',
      dateError: 'A data de fim deve ser igual ou posterior à data de início.',
      view: {
        day: 'Dia',
        allDays: 'Todos os dias',
      },
    },
    cost: {
      total: 'Total',
      paid: 'Pago',
      pending: 'A pagar',
      free: 'Grátis',
      tooltip:
        'Os preços aqui podem não estar atualizados. Toque em cada item para confirmar o valor mais recente.',
    },
    language: {
      label: 'Idioma',
      en: 'English',
      pt: 'Português',
      es: 'Español',
    },
    eventSheet: {
      newTitle: 'Novo evento',
      editTitle: 'Editar evento',
      hint: 'Digite para buscar um lugar, ou use "Escolher no mapa" para clicar em um local.',
      fields: {
        type: 'Tipo',
        start: 'Início',
        end: 'Fim',
        description: 'Descrição',
        place: 'Local',
        placeFrom: 'Local de origem',
        placeTo: 'Local de destino',
        price: 'Preço',
        links: 'Links',
      },
      actions: {
        pickOnMap: 'Escolher no mapa',
        clickOnMap: 'Clique no mapa…',
        existing: 'Existentes',
        searchOrigin: 'Buscar origem…',
        searchDestination: 'Buscar destino…',
        searchPlace: 'Buscar um local…',
        addLink: '+ Adicionar link',
        noLinks: 'Nenhum link.',
        linkLabel: 'Rótulo',
        linkUrl: 'https://…',
        cancel: 'Cancelar',
        save: 'Salvar',
        addEvent: 'Adicionar evento',
        delete: 'Excluir',
        close: 'Fechar',
        clearOrigin: 'Limpar origem',
        clearDestination: 'Limpar destino',
        clearPlace: 'Limpar local',
        removeLink: 'Remover link',
      },
      paid: {
        paid: 'Pago',
        planned: 'Planejado',
      },
      errors: {
        endBeforeStart: 'O fim deve ser depois do início.',
        commuteNeedsPlace: 'Escolha pelo menos um local de origem ou destino para o deslocamento.',
        placeNeedsCoords: 'O local foi definido mas não tem coordenadas. Clique no botão para escolher uma localização no mapa.',
        searchFailed: 'Falha na busca.',
        noResults: 'Sem resultados.',
        searching: 'Buscando…',
      },
      existing: {
        reuseTitle: 'Reutilizar um local já usado nesta viagem',
        noSaved: 'Nenhum local salvo ainda',
      },
    },
    eventTypes: {
      commute: 'Deslocamento',
      sleep: 'Sono',
      food: 'Comida',
      activity: 'Atividade',
      work: 'Trabalho',
      leisure: 'Lazer',
      accommodation: 'Hospedagem',
      other: 'Outro',
    },
    event: {
      at: 'em',
      free: 'grátis',
      paid: 'pago',
      planned: 'planejado',
      arrow: '→',
      unknown: '?',
    },
    calendar: {
      previousDay: 'Dia anterior',
      nextDay: 'Próximo dia',
      dayCount: '{index} de {total}',
      resizeStart: 'Redimensionar início',
      resizeEnd: 'Redimensionar fim',
      empty: 'Selecione uma viagem com pelo menos um dia para ver o calendário.',
    },
    tripModal: {
      titleSelect: 'Suas viagens',
      titleCreate: 'Nova viagem',
      titleEdit: 'Editar viagem',
      empty: 'Nenhuma viagem ainda. Crie sua primeira.',
      fields: {
        name: 'Nome',
        startDate: 'Data de início',
        endDate: 'Data de fim',
      },
      namePlaceholder: 'Tóquio 2026, Road trip de verão…',
      actions: {
        newTrip: 'Nova viagem',
        cancel: 'Cancelar',
        save: 'Salvar',
        createTrip: 'Criar viagem',
        close: 'Fechar',
        edit: 'Editar',
        delete: 'Excluir',
        loadExamples: 'Carregar exemplos',
      },
      errors: {
        nameRequired: 'O nome é obrigatório.',
        datesRequired: 'As datas de início e fim são obrigatórias.',
        endBeforeStart: 'A data de fim deve ser igual ou posterior à data de início.',
      },
      deleteConfirm: 'Excluir a viagem "{name}"? Seus eventos continuarão armazenados, mas ficarão órfãos.',
      examplesConfirm: 'Adicionar 3 viagens de exemplo (Itália, Península Ibérica, Brasil) com eventos?',
      rangeSeparator: '→',
    },
  },
  es: {
    app: {
      trip: 'Viaje',
      switchTrip: 'Cambiar',
      noTrip: 'Sin viaje',
      startDate: 'Fecha de inicio',
      endDate: 'Fecha de fin',
      dateError: 'La fecha de fin debe ser igual o posterior a la fecha de inicio.',
      view: {
        day: 'Día',
        allDays: 'Todos los días',
      },
    },
    cost: {
      total: 'Total',
      paid: 'Pagado',
      pending: 'Por pagar',
      free: 'Gratis',
      tooltip:
        'Los precios mostrados aquí pueden no estar actualizados. Toca cada elemento para confirmar el importe más reciente.',
    },
    language: {
      label: 'Idioma',
      en: 'English',
      pt: 'Português',
      es: 'Español',
    },
    eventSheet: {
      newTitle: 'Nuevo evento',
      editTitle: 'Editar evento',
      hint: 'Escribe para buscar un lugar, o usa "Elegir en el mapa" para hacer clic en una ubicación.',
      fields: {
        type: 'Tipo',
        start: 'Inicio',
        end: 'Fin',
        description: 'Descripción',
        place: 'Lugar',
        placeFrom: 'Lugar de origen',
        placeTo: 'Lugar de destino',
        price: 'Precio',
        links: 'Enlaces',
      },
      actions: {
        pickOnMap: 'Elegir en el mapa',
        clickOnMap: 'Haz clic en el mapa…',
        existing: 'Existentes',
        searchOrigin: 'Buscar origen…',
        searchDestination: 'Buscar destino…',
        searchPlace: 'Buscar un lugar…',
        addLink: '+ Añadir enlace',
        noLinks: 'Sin enlaces.',
        linkLabel: 'Etiqueta',
        linkUrl: 'https://…',
        cancel: 'Cancelar',
        save: 'Guardar',
        addEvent: 'Añadir evento',
        delete: 'Eliminar',
        close: 'Cerrar',
        clearOrigin: 'Borrar origen',
        clearDestination: 'Borrar destino',
        clearPlace: 'Borrar lugar',
        removeLink: 'Quitar enlace',
      },
      paid: {
        paid: 'Pagado',
        planned: 'Planeado',
      },
      errors: {
        endBeforeStart: 'El fin debe ser después del inicio.',
        commuteNeedsPlace: 'Elige al menos un lugar de origen o destino para el trayecto.',
        placeNeedsCoords: 'El lugar está definido pero no tiene coordenadas. Haz clic en el botón para elegir una ubicación en el mapa.',
        searchFailed: 'Búsqueda fallida.',
        noResults: 'Sin resultados.',
        searching: 'Buscando…',
      },
      existing: {
        reuseTitle: 'Reutilizar un lugar ya usado en este viaje',
        noSaved: 'Aún no hay lugares guardados',
      },
    },
    eventTypes: {
      commute: 'Trayecto',
      sleep: 'Sueño',
      food: 'Comida',
      activity: 'Actividad',
      work: 'Trabajo',
      leisure: 'Ocio',
      accommodation: 'Alojamiento',
      other: 'Otro',
    },
    event: {
      at: 'en',
      free: 'gratis',
      paid: 'pagado',
      planned: 'planeado',
      arrow: '→',
      unknown: '?',
    },
    calendar: {
      previousDay: 'Día anterior',
      nextDay: 'Día siguiente',
      dayCount: '{index} de {total}',
      resizeStart: 'Redimensionar inicio',
      resizeEnd: 'Redimensionar fin',
      empty: 'Selecciona un viaje con al menos un día para ver el calendario.',
    },
    tripModal: {
      titleSelect: 'Tus viajes',
      titleCreate: 'Nuevo viaje',
      titleEdit: 'Editar viaje',
      empty: 'Aún no hay viajes. Crea el primero.',
      fields: {
        name: 'Nombre',
        startDate: 'Fecha de inicio',
        endDate: 'Fecha de fin',
      },
      namePlaceholder: 'Tokio 2026, Road trip de verano…',
      actions: {
        newTrip: 'Nuevo viaje',
        cancel: 'Cancelar',
        save: 'Guardar',
        createTrip: 'Crear viaje',
        close: 'Cerrar',
        edit: 'Editar',
        delete: 'Eliminar',
        loadExamples: 'Cargar ejemplos',
      },
      errors: {
        nameRequired: 'El nombre es obligatorio.',
        datesRequired: 'Las fechas de inicio y fin son obligatorias.',
        endBeforeStart: 'La fecha de fin debe ser igual o posterior a la fecha de inicio.',
      },
      deleteConfirm: '¿Eliminar el viaje "{name}"? Sus eventos permanecerán guardados pero quedarán huérfanos.',
      examplesConfirm: '¿Añadir 3 viajes de ejemplo (Italia, Península Ibérica, Brasil) con eventos?',
      rangeSeparator: '→',
    },
  },
};

const AVAILABLE_LOCALES = Object.keys(messages);

const detectInitialLocale = () => {
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && AVAILABLE_LOCALES.includes(stored)) return stored;
    } catch {
      // ignore
    }
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    const lang = navigator.language.toLowerCase().split('-')[0];
    if (AVAILABLE_LOCALES.includes(lang)) return lang;
  }
  return 'en';
};

const state = {
  locale: detectInitialLocale(),
};

const subscribers = new Set();

const persistLocale = (locale) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore
  }
};

export const getLocale = () => state.locale;

export const setLocale = (locale) => {
  if (!AVAILABLE_LOCALES.includes(locale)) return;
  if (state.locale === locale) return;
  state.locale = locale;
  persistLocale(locale);
  for (const cb of subscribers) cb(locale);
};

export const onLocaleChange = (cb) => {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
};

export const getAvailableLocales = () => [...AVAILABLE_LOCALES];

const lookup = (path, obj) => {
  if (obj == null) return undefined;
  const parts = path.split('.');
  let cur = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
};

const interpolate = (template, params) => {
  if (typeof template !== 'string' || !params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : `{${key}}`,
  );
};

export const translate = (key, params, fallback) => {
  const dict = messages[state.locale] || messages.en;
  const value = lookup(key, dict);
  if (value == null) {
    const enValue = lookup(key, messages.en);
    if (enValue == null) return fallback ?? key;
    return interpolate(enValue, params);
  }
  return interpolate(value, params);
};