const app = document.querySelector('#app');
const state = { objects: [], byId: new Map(), journey: [], choices: [] };
const MAX_STOPS = 5;
const START_IDS = ['washington-banknote', 'washington-sculpture', 'inaugural-button-long-live'];
const WASHINGTON_ROUTE = ['washington-banknote','tenino-scrip','washington-sculpture','inaugural-button-long-live','inaugural-button-star','surveyors-compass','camp-chest','camp-stool','washington-waistcoat','washington-breeches','military-uniform','epaulettes','ceremonial-sword','braddock-pistol','charleville-musket','washington-scissor-glasses','benjamin-lincoln-sword'];
const ZONE_ORDER = {West: 0, Center: 1, East: 2};
const FLOOR_GALLERIES = [
  { floor: 1, name: 'Value of Money', label: 'Money room' },
  { floor: 2, name: 'George Washington Sculpture', label: 'Statue room' },
  { floor: 2, name: 'American Democracy', label: 'Button room' },
  { floor: 3, name: 'Price of Freedom', label: 'War room' },
  { floor: 3, name: 'American Presidency', label: 'Map room' }
];
const KID_TITLES = {
  'washington-banknote':'Washington on a Dollar Bill',
  'washington-sculpture':'The Giant Washington Statue',
  'inaugural-button-long-live':'A Button for the First President',
  'inaugural-button-star':'A Star Button for Washington',
  'tenino-scrip':'A Town’s Washington Money',
  'camp-chest':'Washington’s Travel Box',
  'camp-stool':'Washington’s Folding Stool',
  'washington-waistcoat':'Washington’s Vest',
  'washington-breeches':'Washington’s Knee-Length Pants',
  'military-uniform':'Washington’s Army Coat',
  'epaulettes':'Washington’s Gold Shoulder Pieces',
  'ceremonial-sword':'Washington’s Sword',
  'braddock-pistol':'Washington’s Pistol',
  'charleville-musket':'A Gun Marked for the New Country',
  'washington-scissor-glasses':'Folding Glasses for Lafayette',
  'benjamin-lincoln-sword':'A Sword from Yorktown',
  'surveyors-compass':'Washington’s Map-Making Compass',
};
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const kidTitle = object => KID_TITLES[object.id] || object.title;
const objectStops = () => state.journey.filter(step => step.type === 'object');
const currentObject = () => state.byId.get(objectStops().at(-1)?.id);
const onView = object => Boolean(object.gallery?.floor && object.gallery?.name);
const placeLabel = object => {
  if (onView(object)) return `Floor ${object.gallery.floor} · ${FLOOR_GALLERIES.find(gallery => gallery.floor === object.gallery.floor && gallery.name === object.gallery.name)?.label || object.gallery.name}`;
  return 'Museum location unavailable';
};
const scrollTop = () => { window.scrollTo({top: 0, behavior: 'auto'}); app.focus({preventScroll: true}); };
function focusObject() {
  const heading = app.querySelector('.object-detail h1');
  heading?.scrollIntoView({block: 'start', behavior: 'auto'});
  heading?.setAttribute('tabindex', '-1');
  heading?.focus({preventScroll: true});
}
async function loadData() {
  try {
    const response = await fetch('data/washington-objects.json');
    if (!response.ok) throw new Error('Objects could not be loaded.');
    state.objects = await response.json();
    state.byId = new Map(state.objects.map(object => [object.id, object]));
    renderStart();
  } catch (error) {
    app.innerHTML = `<div class="error"><h1>Oops! The objects did not load.</h1><p>${escapeHtml(error.message)}</p><p>Ask a grown-up to open this project with a local web server.</p></div>`;
  }
}
function startCard(object) {
  return `<button class="start-card" data-start="${escapeHtml(object.id)}"><span class="start-card-image"><img src="${escapeHtml(object.image)}" alt="${escapeHtml(object.imageAlt || object.title)}"></span><span class="start-card-copy"><span class="start-card-floor">FLOOR ${object.gallery.floor}</span><strong>${escapeHtml(kidTitle(object))}</strong><span class="start-card-action">Begin here! <span aria-hidden="true">→</span></span></span></button>`;
}
function renderStart() {
  state.journey = [];
  const starters = START_IDS.map(id => state.byId.get(id)).filter(object => object && onView(object));
  app.innerHTML = `<section class="shell kid-start"><div class="start-heading"><span class="start-sparkle" aria-hidden="true">✦</span><span class="eyebrow">George’s Treasure Trail</span><h1 class="display">What do you see?</h1><p>Find the object nearest to you to start.</p></div><div class="start-cards">${starters.map(startCard).join('')}</div></section>`;
  app.querySelectorAll('[data-start]').forEach(button => button.addEventListener('click', () => startJourney(button.dataset.start)));
  scrollTop();
}
function startJourney(id) {
  if (!START_IDS.includes(id)) return;
  state.journey = [{type: 'object', id}];
  renderObject();
}
function getChoices(object) {
  const visited = new Set(objectStops().map(step => step.id));
  const washingtonStops = objectStops().map(step => state.byId.get(step.id));
  const anchor = washingtonStops.at(-1);
  const currentFloor = object.gallery.floor;
  const currentZone = ZONE_ORDER[object.gallery.zone] ?? 0;
  const movesForward = target => onView(target)
    && (target.gallery.floor > currentFloor
      || (target.gallery.floor === currentFloor && (ZONE_ORDER[target.gallery.zone] ?? 0) >= currentZone));
  const directionBonus = target => target.gallery.name === object.gallery.name ? 8
    : target.gallery.floor === currentFloor ? 6
      : target.gallery.floor === currentFloor + 1 ? 4 : 1;
  const startIndex = WASHINGTON_ROUTE.indexOf(anchor.id);
  const nextWashingtonId = WASHINGTON_ROUTE.slice(startIndex + 1).find(id => {
    const target = state.byId.get(id);
    return target && !visited.has(id) && movesForward(target);
  });
  const selected = nextWashingtonId ? [{label:'George Washington',field:'topics',value:'George Washington',sourceId:anchor.id,targetId:nextWashingtonId,route:'washington'}] : [];
  const detours = objectStops().flatMap(step => {
    const source = state.byId.get(step.id);
    return state.objects.filter(target => movesForward(target) && !visited.has(target.id) && target.id !== nextWashingtonId)
      .flatMap(target => ['materials','topics','periods'].flatMap(field => (source[field] || [])
        .filter(value => value !== 'George Washington' && target[field]?.includes(value))
        .map(value => ({label:value,field,value,sourceId:source.id,targetId:target.id,route:'detour',score:(field === 'materials' ? 5 : field === 'topics' ? 3 : 1) + directionBonus(target) + (source.id === object.id ? 2 : 0)}))));
  });
  detours.sort((a,b) => b.score - a.score || WASHINGTON_ROUTE.indexOf(a.targetId) - WASHINGTON_ROUTE.indexOf(b.targetId));
  for (const link of detours) {
    if (selected.length >= 3) break;
    if (!selected.some(item => item.targetId === link.targetId || item.value === link.value)) selected.push(link);
  }
  if (selected.length < 3) {
    for (const link of detours) {
      if (selected.length >= 3) break;
      if (!selected.some(item => item.targetId === link.targetId)) selected.push(link);
    }
  }
  return selected;
}
function ideaLabel(value) {
  return ({'18th century':'the 1700s','19th century':'the 1800s','20th century':'the 1900s',Clothing:'clothes',Craft:'making things','Domestic Life':'home','Food and Cooking':'food','Maps and Geography':'maps',Metalwork:'metal','Military History':'soldiers',Portraiture:'pictures of people','Public Memory':'remembering George',Sculpture:'statues',Surveying:'measuring land',Technology:'inventions',Transportation:'ways to travel',Travel:'travel'})[value] || value;
}
function choiceLabel(link) {
  if (link.route === 'washington') return 'Stay with George';
  if (link.value === 'Public Memory') return 'Remember George';
  if (link.field === 'materials') return `Follow the ${ideaLabel(link.value)}`;
  if (link.field === 'periods') return `Travel to ${ideaLabel(link.value)}`;
  return `Explore ${ideaLabel(link.value)}`;
}
function renderObject() {
  const object = currentObject();
  if (!object) return renderStart();
  const count = objectStops().length;
  state.choices = count < MAX_STOPS ? getChoices(object) : [];
  const choicesHtml = count === MAX_STOPS
    ? `<div class="choices"><h2>You found all five!</h2><p>Now you can see the story your choices made.</p><button class="button red" id="see-journey">See my treasure map <span aria-hidden="true">→</span></button></div>`
    : `<div class="choices"><h2>Where will your story go?</h2><p>Pick a clue to find the next object.</p><div class="choice-grid">${state.choices.map((link,index) => { const target = state.byId.get(link.targetId); return `<button class="choice" data-choice="${index}"><span class="choice-number">${link.route === 'washington' ? '★ GEORGE’S TRAIL' : '✦ FOLLOW A CLUE'}</span><img class="choice-thumb" src="${escapeHtml(target.image)}" alt=""><strong>${escapeHtml(choiceLabel(link))}</strong><span class="choice-place">${escapeHtml(placeLabel(target))} →</span></button>`; }).join('')}</div>${state.choices.length ? '' : '<button class="button" id="return-map">Pick a new first object</button>'}</div>`;
  const sourceNote = onView(object) ? 'The museum lists this object in the room area shown above. Words and idea links were written for this story.' : 'This is a real museum object, but its display room is not confirmed. Idea links were written for this story.';
  app.innerHTML = `<section class="shell kid-object"><div class="progress-row"><span class="eyebrow">STOP ${count} OF ${MAX_STOPS}</span><div class="progress-track" aria-label="${count} of ${MAX_STOPS} objects found">${Array.from({length:MAX_STOPS},(_,i)=>`<span class="${i<count?'active':''}"></span>`).join('')}</div></div><div class="object-layout"><div class="object-visual"><img src="${escapeHtml(object.image)}" alt="${escapeHtml(object.imageAlt || object.title)}"></div><div class="object-detail"><span class="eyebrow">${count === 1 ? 'Your story starts here' : 'The next page of your story'}</span><h1 class="section-title">${escapeHtml(kidTitle(object))}</h1><p class="description">${escapeHtml(object.story || object.description)}</p><div class="kid-place"><span aria-hidden="true">${onView(object) ? '⌖' : '✦'}</span><strong>${escapeHtml(placeLabel(object))}</strong></div>${choicesHtml}<details class="object-facts"><summary>Grown-up facts</summary><dl><dt>Museum name</dt><dd>${escapeHtml(object.title)}</dd><dt>About it</dt><dd>${escapeHtml(object.description)}</dd><dt>When?</dt><dd>${escapeHtml(object.date)}</dd><dt>What is it?</dt><dd>${escapeHtml(object.objectType.join(', '))}</dd><dt>Museum</dt><dd>${escapeHtml(object.museum)}</dd></dl>${object.recordUrl ? `<p><a href="${escapeHtml(object.recordUrl)}" target="_blank" rel="noopener noreferrer">See the museum record ↗</a></p>` : ''}${object.imageSource ? `<p><a href="${escapeHtml(object.imageSource)}" target="_blank" rel="noopener noreferrer">Photo source ↗</a></p>` : ''}<p class="source-note">${escapeHtml(sourceNote)}</p></details></div></div></section>`;
  app.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => followChoice(state.choices[Number(button.dataset.choice)])));
  app.querySelector('#see-journey')?.addEventListener('click', renderJourney);
  app.querySelector('#return-map')?.addEventListener('click', renderStart);
  focusObject();
}
function followChoice(link) {
  if (!link || objectStops().length >= MAX_STOPS || objectStops().some(step => step.id === link.targetId)) return;
  state.journey.push({type:'connection',label:link.label,value:link.value,sourceId:link.sourceId,route:link.route});
  state.journey.push({type:'object',id:link.targetId});
  renderObject();
}
const mapIllustration = object => `assets/illustrations/${object.id}.png`;
const materialLabel = material => ({textile:'fabric',wool:'wool',metal:'metal',wood:'wood',paper:'paper',steel:'steel',brass:'brass',ink:'ink',marble:'marble',leather:'leather',ivory:'ivory'})[material] || material;
function renderJourney() {
  const stops = objectStops().map(step => state.byId.get(step.id));
  const lanes = new Map([['online',[]],[3,[]],[2,[]],[1,[]]]);
  stops.forEach((object,index) => lanes.get(onView(object) ? object.gallery.floor : 'online').push(index));
  const rows = ['online',3,2,1].filter(lane => lanes.get(lane).length);
  const rowTop = new Map(rows.map((lane,index) => [lane,24 + index * 244]));
  const mapHeight = 24 + rows.length * 244 + 170;
  const points = stops.map((object,index) => {
    const lane = onView(object) ? object.gallery.floor : 'online';
    const group = lanes.get(lane);
    const position = group.indexOf(index);
    const x = group.length === 1 ? 500 : group.length === 2 ? 230 + position * 540 : group.length === 3 ? 190 + position * 310 : 110 + 780 * position / (group.length - 1);
    return {x,y:rowTop.get(lane) + 128};
  });
  const xPoint = {x:500,y:mapHeight - 72};
  const routePoints = [...points, xPoint];
  const arrows = routePoints.slice(0,-1).map((point,index) => {
    const next = routePoints[index + 1];
    const distance = Math.hypot(next.x - point.x,next.y - point.y);
    const ux = (next.x - point.x) / distance;
    const uy = (next.y - point.y) / distance;
    const x1 = point.x + ux * 62;
    const y1 = point.y + uy * 62;
    const x2 = next.x - ux * 67;
    const y2 = next.y - uy * 67;
    const bend = index % 2 === 0 ? 34 : -34;
    const cx = (x1 + x2) / 2 - uy * bend;
    const cy = (y1 + y2) / 2 + ux * bend;
    return `<path d="M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}" marker-end="url(#trail-arrow)"/>`;
  }).join('');
  const bands = rows.map(lane => `<div class="treasure-band ${lane === 'online' ? 'band-online' : `band-${lane}`}" style="top:${rowTop.get(lane) / mapHeight * 100}%;height:${220 / mapHeight * 100}%"><span>${lane === 'online' ? '☁<small>ONLINE</small>' : `${lane}<small>FLOOR</small>`}</span></div>`).join('');
  const landmarks = stops.map((object,index) => {
    const point = points[index];
    return `<div class="treasure-landmark" style="left:${point.x / 10}%;top:${point.y / mapHeight * 100}%"><img src="${escapeHtml(mapIllustration(object))}" alt=""><strong>${escapeHtml(kidTitle(object))}</strong></div>`;
  }).join('');
  app.innerHTML = `<section class="shell kid-finale"><div class="final-hero"><span class="eyebrow">You did it!</span><h1 class="section-title">Your treasure map</h1><p>Follow the dotted arrows past all five objects. The last arrow leads to the big red X—click it to start George’s Time Machine!</p></div><div class="treasure-map" style="aspect-ratio:1000/${mapHeight}" role="group" aria-label="Your five-stop museum treasure map">${bands}<svg class="treasure-trail" viewBox="0 0 1000 ${mapHeight}" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="trail-arrow" viewBox="0 0 20 18" markerWidth="20" markerHeight="18" refX="17" refY="9" orient="auto" markerUnits="userSpaceOnUse"><path d="M2 2 L18 9 L2 16 Z" class="trail-arrowhead"/></marker></defs>${arrows}</svg>${landmarks}<button class="map-x-stop" id="start-time-machine" style="left:${xPoint.x / 10}%;top:${xPoint.y / mapHeight * 100}%" aria-label="Start George’s Time Machine"><span aria-hidden="true">×</span><strong>Start the Time Machine!</strong></button></div><p class="treasure-note">The floors and objects come from your journey. The arrows show the order you visited them.</p><div class="final-actions"><button class="button" id="again">Start a new story <span aria-hidden="true">↗</span></button></div></section>`;
  app.querySelector('#start-time-machine')?.addEventListener('click', renderTimeMachine);
  app.querySelector('#again').addEventListener('click', renderStart);
  scrollTop();
}
const fromGeorgesLifetime = object => object.periods?.includes('18th century');
function renderTimeMachine() {
  const stops = objectStops().map(step => state.byId.get(step.id));
  const during = stops.filter(fromGeorgesLifetime);
  const after = stops.filter(object => !fromGeorgesLifetime(object));
  const journeyInsight = during.length === stops.length
    ? 'All five treasures are from when George was alive!'
    : during.length > after.length
      ? `${during.length} treasures are from George’s lifetime. ${after.length} ${after.length === 1 ? 'was' : 'were'} made later.`
      : `${during.length} ${during.length === 1 ? 'treasure is' : 'treasures are'} from George’s lifetime. ${after.length} were made later.`;
  const objectPicture = object => `<div class="time-object found" aria-label="${escapeHtml(kidTitle(object))}"><img src="${escapeHtml(mapIllustration(object))}" alt=""><strong>${escapeHtml(kidTitle(object))}</strong></div>`;
  const emptyEra = '<p class="empty-era">No treasures from this time.</p>';
  app.innerHTML = `<section class="shell time-finale"><div class="final-hero"><span class="eyebrow">Whoosh! Back through time</span><h1 class="section-title">George’s Time Machine</h1><p>Let’s put your five treasures in time.</p></div><div class="time-insight"><span aria-hidden="true">⌛</span><strong>${escapeHtml(journeyInsight)}</strong></div><div class="time-machine" aria-label="Your five objects organized by whether they were made during or after George Washington’s lifetime"><section class="time-era era-during"><header><span class="era-date">1700s</span><div><h2>When George was alive</h2><p>${during.length} ${during.length === 1 ? 'treasure' : 'treasures'}</p></div></header><div class="time-objects">${during.length ? during.map(objectPicture).join('') : emptyEra}</div></section><div class="time-arrow" aria-hidden="true"><span>TIME MOVES THIS WAY</span><b>→</b></div><section class="time-era era-after"><header><span class="era-date">1800s–1900s</span><div><h2>Made after George lived</h2><p>${after.length} ${after.length === 1 ? 'treasure' : 'treasures'}</p></div></header><div class="time-objects">${after.length ? after.map(objectPicture).join('') : emptyEra}</div></section></div><div class="final-actions time-actions"><button class="button secondary" id="back-to-map">Back to my map</button><button class="button" id="again">Start a new story <span aria-hidden="true">↗</span></button></div></section>`;
  app.querySelector('#back-to-map').addEventListener('click', renderJourney);
  app.querySelector('#again').addEventListener('click', renderStart);
  scrollTop();
}
document.querySelector('#home-link').addEventListener('click', event => { event.preventDefault(); renderStart(); });
loadData();
