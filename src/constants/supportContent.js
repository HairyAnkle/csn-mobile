export const FAQ_ITEMS = [
  {
    q: 'How does the 1-second Hold-to-Send SOS work?',
    a: 'To prevent accidental triggers in a pocket or bag, press and hold the red Hold-to-Send button for 1 full second, or tap "Send Alert" and confirm in the dialog.',
  },
  {
    q: 'What is the difference between High and Low Urgency?',
    a: 'High Urgency immediately alerts both the Parañaque CSN Center and Parañaque DRRMO / 911 Ambulance units for life-threatening crises, seizures, or missing children. Low Urgency notifies CSN center staff for non-life-threatening sensory or behavioral assistance.',
  },
  {
    q: 'Does my child’s medical profile get sent automatically?',
    a: 'Yes. As soon as you trigger an alert, responders see your child’s name, age, disability classification (e.g. ASD), allergies, medications, and communication notes (e.g. Non-verbal, sound sensitivity) so they approach without sirens if needed.',
  },
  {
    q: 'What if I lose internet or GPS signal during an emergency?',
    a: 'If your internet connection drops, use the red "Call 911" or "Call CSN Hotline" buttons at the top of Support & Active screens to dial over cellular voice.',
  },
];

export const FAQ_ITEMS_FIL = [
  {
    q: 'Paano gumagana ang 1-segundong Hold-to-Send SOS?',
    a: 'Upang maiwasan ang aksidenteng pagpindot sa bulsa o bag, pindutin nang matagal ang pulang button sa loob ng 1 segundo, o i-tap ang "Ipadala ang Alerto" at kumpirmahin sa dialog.',
  },
  {
    q: 'Ano ang pagkakaiba ng Mataas at Mababang Urgency?',
    a: 'Ang Mataas na Urgency ay agad na nag-aabiso sa Parañaque CSN Center at Parañaque DRRMO / 911 Ambulansya para sa mga kritikal na krisis, kombulsyon, o nawawalang bata. Ang Mababang Urgency ay nag-aabiso sa staff ng CSN Center para sa hindi nakamamatay na tulong sa pandama o pag-uugali.',
  },
  {
    q: 'Awtomatiko bang naipapadala ang medikal na profile ng aking anak?',
    a: 'Opo. Sa sandaling magpadala ka ng alerto, makikita agad ng mga responder ang pangalan, edad, klasipikasyon ng kapansanan (hal. ASD), mga alerdye, gamot, at tala sa komunikasyon (hal. Non-verbal, sensitibo sa ingay) upang lumapit nang walang malakas na sirena kung kinakailangan.',
  },
  {
    q: 'Paano kung mawalan ako ng internet o GPS signal habang may emergency?',
    a: 'Kung mawalan ng koneksyon sa internet, gamitin ang pulang button na "Tumawag sa 911" o "CSN Hotline" sa itaas ng screen ng Suporta at Aktibong Alerto upang makatawag agad gamit ang cellular voice.',
  },
];

export const SAFETY_RESOURCES = [
  {
    title: 'Sensory Overload & Meltdown De-escalation Protocol',
    tag: 'ASD / Sensory Guide',
    icon: 'ear-outline',
    color: '#005B96',
    steps: [
      'Move your child to a quiet, dimly lit space away from crowds.',
      'Offer noise-canceling headphones or a familiar comfort item.',
      'Use short, calm visual cues or AAC cards rather than complex verbal questions.',
      'If in public and unsafe, trigger a Low or High Urgency Seizure/Sensory Alert so responders arrive with sirens turned off.',
    ],
  },
  {
    title: 'Wandering / Elopement Emergency Checklist',
    tag: 'Missing Child Protocol',
    icon: 'walk-outline',
    color: '#E11D48',
    steps: [
      'Immediately trigger a "Wandering / Missing" High Urgency Alert with Live GPS enabled.',
      'Check nearby water hazards, busy intersections, and favorite sensory spots first.',
      'Share the child’s current clothing description in the Optional Situation Message box.',
    ],
  },
  {
    title: 'Pediatric Seizure First-Aid Guide',
    tag: 'Medical Crisis',
    icon: 'medkit-outline',
    color: '#10B981',
    steps: [
      'Ease the child gently to the floor and turn them onto their side to keep airways clear.',
      'Clear hard or sharp objects from the area; place something soft under their head.',
      'Time the seizure—if it lasts longer than 5 minutes, dispatch a High Urgency Medical Crisis alert immediately.',
    ],
  },
];

export const SAFETY_RESOURCES_FIL = [
  {
    title: 'Gabay sa Pagpapakalma ng Sensory Overload at Meltdown',
    tag: 'Gabay sa ASD / Pandama',
    icon: 'ear-outline',
    color: '#005B96',
    steps: [
      'Ilipat ang bata sa isang tahimik at hindi masyadong maliwanag na lugar na malayo sa maraming tao.',
      'Magbigay ng noise-canceling headphones o pamilyar na pampakalmang gamit.',
      'Gumamit ng maikli at mahinahong visual cues o AAC cards sa halip na mahahabang tanong.',
      'Kung nasa pampublikong lugar at hindi ligtas, magpadala ng Seizure/Sensory Alert upang lumapit ang mga responder nang naka-off ang sirena.',
    ],
  },
  {
    title: 'Checklist sa Emergency ng Paglalagalag / Pagkawala',
    tag: 'Protokol sa Nawawalang Bata',
    icon: 'walk-outline',
    color: '#E11D48',
    steps: [
      'Magpadala agad ng High Urgency na alertong "Paglalagalag / Nawawala" habang naka-on ang Live GPS.',
      'Suriin muna ang mga kalapit na tubigan, abalang kalsada, at mga paboritong lugar ng bata.',
      'Ilagay ang suot na damit ng bata sa kahon ng Karagdagang Mensahe.',
    ],
  },
  {
    title: 'Gabay sa Paunang Lunas sa Kombulsyon (Seizure) ng Bata',
    tag: 'Medikal na Krisis',
    icon: 'medkit-outline',
    color: '#10B981',
    steps: [
      'Dahan-dahang ihiga ang bata sa sahig at itagilid siya upang manatiling maluwag ang daanan ng hangin.',
      'Alisin ang mga matitigas o matutulis na bagay sa paligid; maglagay ng malambot na sapin sa ilalim ng ulo.',
      'Orasan ang kombulsyon—kung tumagal nang mahigit 5 minuto, magpadala agad ng High Urgency Medical Crisis alert.',
    ],
  },
];

export const VIDEO_TUTORIALS = [
  {
    id: 'vid-1',
    title: 'How to Trigger an SOS Alert & Share Live GPS',
    duration: '1:45',
    summary: 'Walkthrough of selecting an Alert Type, choosing High vs. Low Urgency, and streaming GPS coordinates to Parañaque responders.',
    steps: [
      '0:00 — Tap "TRIGGER EMERGENCY ALERT" in the thumb zone on the Dashboard.',
      '0:30 — Choose the incident type (Medical, Seizure/Sensory, Fire, Wandering, or General).',
      '1:00 — Select High Urgency (notifies Ambulance) and hold the confirmation bar for 1 second.',
    ],
  },
  {
    id: 'vid-2',
    title: 'Setting Up Your Child’s CSN Medical & Sensory Profile',
    duration: '2:10',
    summary: 'How to configure Disability Classification, allergies, and sensory notes so emergency responders know how to communicate with your child.',
    steps: [
      '0:00 — Open the Medical Info tab from the bottom navigation bar.',
      '0:45 — Choose a Disability Classification from the dropdown (e.g., Autism Spectrum Disorder).',
      '1:30 — Tap quick-tags like "Non-verbal" and "Sound sensitivity", then tap "Save Changes".',
    ],
  },
  {
    id: 'vid-3',
    title: 'Using the Interactive Map & Nearby Emergency Centers',
    duration: '1:30',
    summary: 'How to locate the nearest Parañaque hospital, DRRMO command post, or CSN Center and start/stop live coordinate sharing.',
    steps: [
      '0:00 — Open the Live GPS tab.',
      '0:30 — Toggle "Live Coordinate Streaming" on or off at any time.',
      '1:00 — Tap any facility pin on the map to view distance in km, get directions, or call directly.',
    ],
  },
];

export const VIDEO_TUTORIALS_FIL = [
  {
    id: 'vid-1',
    title: 'Paano Magpadala ng SOS Alert at Magbahagi ng Live GPS',
    duration: '1:45',
    summary: 'Gabay sa pagpili ng Uri ng Alerto, pagpili ng Mataas vs. Mababang Urgency, at pagbabahagi ng lokasyon sa mga responder sa Parañaque.',
    steps: [
      '0:00 — I-tap ang "IPADALA ANG EMERGENCY ALERT" sa ibaba ng Dashboard.',
      '0:30 — Piliin ang uri ng insidente (Medikal, Kombulsyon/Pandama, Sunog, Paglalagalag, o Pangkalahatan).',
      '1:00 — Piliin ang Mataas na Urgency (nag-aabiso sa Ambulansya) at pindutin nang matagal ang bar sa loob ng 1 segundo.',
    ],
  },
  {
    id: 'vid-2',
    title: 'Pag-set Up ng Medikal at Sensory Profile ng Iyong Anak',
    duration: '2:10',
    summary: 'Paano ilagay ang Klasipikasyon ng Kapansanan, mga alerdye, at tala sa pandama upang malaman ng mga responder kung paano kakausapin ang bata.',
    steps: [
      '0:00 — Buksan ang Medikal na tab sa ibabang navigation bar.',
      '0:45 — Pumili ng Klasipikasyon ng Kapansanan mula sa dropdown (hal. Autism Spectrum Disorder).',
      '1:30 — I-tap ang mga quick-tag tulad ng "Non-verbal" at "Sound sensitivity", pagkatapos ay i-tap ang "I-save ang Pagbabago".',
    ],
  },
  {
    id: 'vid-3',
    title: 'Paggamit ng Interactive na Mapa at Mga Kalapit na Emergency Center',
    duration: '1:30',
    summary: 'Paano hanapin ang pinakamalapit na ospital sa Parañaque, DRRMO command post, o CSN Center at buksan/isara ang pagbabahagi ng lokasyon.',
    steps: [
      '0:00 — Buksan ang Live GPS na tab.',
      '0:30 — I-on o i-off ang "Live Coordinate Streaming" anumang oras.',
      '1:00 — I-tap ang alinmang pin ng pasilidad sa mapa upang makita ang distansya sa km, kumuha ng ruta, o tumawag agad.',
    ],
  },
];

export const CHAT_QUICK_TOPICS = [
  'Request a Callback',
  'CSN Center Schedule & Address',
  'Sensory Overload Advice',
  'Update Child Medical Info',
];

export const CHAT_QUICK_TOPICS_FIL = [
  'Humiling ng Tawag Pabalik',
  'Oras at Address ng CSN Center',
  'Payo sa Sensory Overload',
  'I-update ang Medikal na Info ng Bata',
];

export function getSupportContent(lang = 'English') {
  if (lang === 'Filipino') {
    return {
      faqs: FAQ_ITEMS_FIL,
      resources: SAFETY_RESOURCES_FIL,
      videos: VIDEO_TUTORIALS_FIL,
      quickTopics: CHAT_QUICK_TOPICS_FIL,
    };
  }
  return {
    faqs: FAQ_ITEMS,
    resources: SAFETY_RESOURCES,
    videos: VIDEO_TUTORIALS,
    quickTopics: CHAT_QUICK_TOPICS,
  };
}
