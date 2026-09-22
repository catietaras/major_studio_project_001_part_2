const app = document.querySelector('#app');
const state = { objects: [], byId: new Map(), journey: [], choices: [] };
const MAX_STOPS = 5;
const START_IDS = ['washington-banknote', 'washington-sculpture', 'inaugural-button-long-live'];
const WASHINGTON_ROUTE = ['washington-banknote','tenino-scrip','washington-sculpture','inaugural-button-long-live','inaugural-button-star','camp-chest','camp-stool','washington-waistcoat','washington-breeches','military-uniform','epaulettes','ceremonial-sword','braddock-pistol','charleville-musket','washington-scissor-glasses','benjamin-lincoln-sword','surveyors-compass','bache-silhouette','coffin-fragment'];
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
  'bache-silhouette':'Washington’s Shadow Portrait',
  'coffin-fragment':'A Piece Kept to Remember Washington'
};
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const kidTitle = object => KID_TITLES[object.id] || object.title;
const objectStops = () => state.journey.filter(step => step.type === 'object');
const currentObject = () => state.byId.get(objectStops().at(-1)?.id);
const onView = object => object.gallery?.status === 'verified-on-view';
const placeLabel = object => {
  if (onView(object)) return `Floor ${object.gallery.floor} · ${FLOOR_GALLERIES.find(gallery => gallery.floor === object.gallery.floor && gallery.name === object.gallery.name)?.label || object.gallery.name}`;
  return object.dataStatus === 'illustrative-curated-placeholder' ? 'Story idea · Not in the museum' : 'Explore online';
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
    const responses = await Promise.all(['data/washington-objects.json','data/collection-objects.json'].map(path => fetch(path)));
    if (responses.some(response => !response.ok)) throw new Error('Object files could not be loaded.');
    state.objects = (await Promise.all(responses.map(response => response.json()))).flat();
    state.byId = new Map(state.objects.map(object => [object.id, object]));
    validateConnections();
    renderStart();
  } catch (error) {
    app.innerHTML = `<div class="error"><h1>Oops! The objects did not load.</h1><p>${escapeHtml(error.message)}</p><p>Ask a grown-up to open this project with a local web server.</p></div>`;
  }
}
function validateConnections() {
  for (const object of state.objects) {
    object.connections = (object.connections || []).filter(link => {
      const target = state.byId.get(link.targetId);
      return target && object[link.field]?.includes(link.value) && target[link.field]?.includes(link.value);
    });
  }
}
function startCard(object) {
  return `<button class="start-card" data-start="${escapeHtml(object.id)}"><span class="start-card-image"><img src="${escapeHtml(object.image)}" alt="${escapeHtml(object.imageAlt || object.title)}"></span><span class="start-card-copy"><span class="start-card-floor">FLOOR ${object.gallery.floor}</span><strong>${escapeHtml(kidTitle(object))}</strong><span class="start-card-action">Begin here! <span aria-hidden="true">→</span></span></span></button>`;
}
function renderStart() {
  state.journey = [];
  const starters = START_IDS.map(id => state.byId.get(id)).filter(object => object && onView(object));
  app.innerHTML = `<section class="shell kid-start"><div class="start-heading"><span class="start-sparkle" aria-hidden="true">✦</span><h1 class="display">Your story starts here!</h1><p>Choose an object. It has a clue that will lead you to the next one.</p></div><div class="start-cards">${starters.map(startCard).join('')}</div></section>`;
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
  const washingtonStops = objectStops().map(step => state.byId.get(step.id)).filter(item => item.isWashingtonObject);
  const anchor = washingtonStops.at(-1);
  const startIndex = WASHINGTON_ROUTE.indexOf(anchor.id);
  const nextWashingtonId = [...WASHINGTON_ROUTE.slice(startIndex + 1), ...WASHINGTON_ROUTE.slice(0, startIndex + 1)].find(id => !visited.has(id));
  const selected = nextWashingtonId ? [{label:'George Washington',field:'topics',value:'George Washington',sourceId:anchor.id,targetId:nextWashingtonId,route:'washington'}] : [];
  const detours = objectStops().flatMap(step => {
    const source = state.byId.get(step.id);
    return state.objects.filter(target => target.isWashingtonObject && !visited.has(target.id) && target.id !== nextWashingtonId)
      .flatMap(target => ['materials','topics','periods'].flatMap(field => (source[field] || [])
        .filter(value => value !== 'George Washington' && target[field]?.includes(value))
        .map(value => ({label:value,field,value,sourceId:source.id,targetId:target.id,route:'detour',score:(field === 'materials' ? 5 : field === 'topics' ? 3 : 1) + (onView(target) ? 2 : 0) + (source.id === object.id ? 2 : 0)}))));
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
    : `<div class="choices"><h2>Where will your story go?</h2><p>Pick a clue to find the next object.</p><div class="choice-grid">${state.choices.map((link,index) => { const target = state.byId.get(link.targetId); return `<button class="choice" data-choice="${index}"><span class="choice-number">${link.route === 'washington' ? '★ GEORGE’S TRAIL' : '✦ FOLLOW A CLUE'}</span><img class="choice-thumb" src="${escapeHtml(target.image)}" alt=""><strong>${escapeHtml(choiceLabel(link))}</strong><small>${escapeHtml(kidTitle(target))}</small><span class="choice-place">${escapeHtml(placeLabel(target))} →</span></button>`; }).join('')}</div>${state.choices.length ? '' : '<button class="button" id="return-map">Pick a new first object</button>'}</div>`;
  const sourceNote = onView(object) ? 'The museum lists this object in the room area shown above. Words and idea links were written for this story.' : object.dataStatus === 'illustrative-curated-placeholder' ? 'This is a made-up example for this prototype. Its picture and details are not from a museum record.' : 'This is a real museum object, but its display room is not confirmed. Idea links were written for this story.';
  app.innerHTML = `<section class="shell kid-object"><div class="progress-row"><span class="eyebrow">STOP ${count} OF ${MAX_STOPS}</span><div class="progress-track" aria-label="${count} of ${MAX_STOPS} objects found">${Array.from({length:MAX_STOPS},(_,i)=>`<span class="${i<count?'active':''}"></span>`).join('')}</div></div><div class="object-layout"><div class="object-visual"><img src="${escapeHtml(object.image)}" alt="${escapeHtml(object.imageAlt || object.title)}"></div><div class="object-detail"><span class="eyebrow">${object.isWashingtonObject ? (count === 1 ? 'Your story starts here' : 'The next page of your story') : 'A new page of your story'}</span><h1 class="section-title">${escapeHtml(kidTitle(object))}</h1><p class="description">${escapeHtml(object.story || object.description)}</p><div class="kid-place"><span aria-hidden="true">${onView(object) ? '⌖' : '✦'}</span><strong>${escapeHtml(placeLabel(object))}</strong></div>${choicesHtml}<details class="object-facts"><summary>Grown-up facts</summary><dl><dt>Museum name</dt><dd>${escapeHtml(object.title)}</dd><dt>About it</dt><dd>${escapeHtml(object.description)}</dd><dt>When?</dt><dd>${escapeHtml(object.date)}</dd><dt>What is it?</dt><dd>${escapeHtml(object.objectType.join(', '))}</dd><dt>Museum</dt><dd>${escapeHtml(object.museum)}</dd></dl>${object.recordUrl ? `<p><a href="${escapeHtml(object.recordUrl)}" target="_blank" rel="noopener noreferrer">See the museum record ↗</a></p>` : ''}${object.imageSource ? `<p><a href="${escapeHtml(object.imageSource)}" target="_blank" rel="noopener noreferrer">Photo source ↗</a></p>` : ''}<p class="source-note">${escapeHtml(sourceNote)}</p></details></div></div></section>`;
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
function renderJourney() {
  const stops = objectStops().map(step => state.byId.get(step.id));
  const connections = state.journey.filter(step => step.type === 'connection');
  const lanes = new Map([['online',[]],[3,[]],[2,[]],[1,[]]]);
  stops.forEach((object,index) => lanes.get(onView(object) ? object.gallery.floor : 'online').push(index));
  const rows = ['online',3,2,1].filter(lane => lanes.get(lane).length);
  const rowTop = new Map(rows.map((lane,index) => [lane,24 + index * 244]));
  const mapHeight = 24 + rows.length * 244 + 24;
  const points = stops.map((object,index) => {
    const lane = onView(object) ? object.gallery.floor : 'online';
    const group = lanes.get(lane);
    const position = group.indexOf(index);
    const x = group.length === 1 ? 500 : group.length === 2 ? 230 + position * 540 : group.length === 3 ? 190 + position * 310 : 110 + 780 * position / (group.length - 1);
    return {x,y:rowTop.get(lane) + 128};
  });
  const arrows = points.slice(0,-1).map((point,index) => {
    const next = points[index + 1];
    const distance = Math.hypot(next.x - point.x,next.y - point.y);
    const ux = (next.x - point.x) / distance;
    const uy = (next.y - point.y) / distance;
    return `<line x1="${point.x + ux * 78}" y1="${point.y + uy * 78}" x2="${next.x - ux * 82}" y2="${next.y - uy * 82}" marker-end="url(#trail-arrow)"/>`;
  }).join('');
  const bands = rows.map(lane => `<div class="treasure-band ${lane === 'online' ? 'band-online' : `band-${lane}`}" style="top:${rowTop.get(lane) / mapHeight * 100}%;height:${220 / mapHeight * 100}%"><span>${lane === 'online' ? '☁<small>ONLINE</small>' : `${lane}<small>FLOOR</small>`}</span></div>`).join('');
  const markers = stops.map((object,index) => {
    const point = points[index];
    const clue = index === 0 ? 'START' : index === stops.length - 1 ? 'FINISH' : connections[index - 1].route === 'washington' ? 'GEORGE' : ideaLabel(connections[index - 1].value).toUpperCase();
    return `<div class="treasure-stop" style="left:${point.x / 10}%;top:${point.y / mapHeight * 100}%"><span class="treasure-number">${index + 1}</span><img src="${escapeHtml(object.image)}" alt="${escapeHtml(object.imageAlt || object.title)}"><strong>${escapeHtml(kidTitle(object))}</strong><small>${escapeHtml(placeLabel(object))}</small><em>${escapeHtml(clue)}</em></div>`;
  }).join('');
  app.innerHTML = `<section class="shell kid-finale"><div class="final-hero"><span class="eyebrow">You did it!</span><h1 class="section-title">Your treasure map</h1><p>Your first find was ${escapeHtml(kidTitle(stops[0]))}. Follow the arrows to see where your story went!</p></div><div class="treasure-map" style="aspect-ratio:1000/${mapHeight}" role="group" aria-label="Your five-stop museum treasure map">${bands}<svg class="treasure-trail" viewBox="0 0 1000 ${mapHeight}" preserveAspectRatio="none" aria-hidden="true"><defs><marker id="trail-arrow" viewBox="0 0 12 12" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1 L11 6 L1 11 Z" fill="#a86446"/></marker></defs>${arrows}</svg>${markers}</div><p class="treasure-note">Your story visited these floors and rooms. A museum guide can help you find the exact spots.</p><div class="final-actions"><button class="button" id="again">Start a new story <span aria-hidden="true">↗</span></button></div></section>`;
  app.querySelector('#again').addEventListener('click', renderStart);
  scrollTop();
}
document.querySelector('#home-link').addEventListener('click', event => { event.preventDefault(); renderStart(); });
loadData();
