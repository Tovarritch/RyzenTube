// Grid pages such as Subscriptions arrive as a stack of short rows (three
// videos each, only the first titled). Filters that remove videos (duplicates,
// watched, members-only, blocked channels, Shorts) leave those rows short or
// empty. This refills each run of rows in order, so only the last row of a run
// can be short. Rows of a page that is still loading keep their remainder for
// the next page instead of ending in a short row.
//
// Titled rows that scroll sideways (Home) are runs of one row and stay as is.

const MAX_GRID_ROW = 6;

// The remainder held back for the next page: { items, capacity, template }.
let carry = null;

function rowList(shelf) {
  const list = shelf?.shelfRenderer?.content?.horizontalListRenderer;
  return list && Array.isArray(list.items) ? list : null;
}
const titled = shelf => !!(shelf?.shelfRenderer?.title || shelf?.shelfRenderer?.headerRenderer);
const titleOf = shelf => JSON.stringify(shelf?.shelfRenderer?.title || shelf?.shelfRenderer?.headerRenderer || null);

function contentLists(r) {
  const lists = [];
  const add = (holder, key) => { if (Array.isArray(holder?.[key])) lists.push({ holder, key }); };
  add(r?.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer?.content?.sectionListRenderer, 'contents');
  for (const section of r?.contents?.tvBrowseRenderer?.content?.tvSecondaryNavRenderer?.sections || []) {
    for (const tab of section?.tvSecondaryNavSectionRenderer?.tabs || []) {
      add(tab?.tabRenderer?.content?.tvSurfaceContentRenderer?.content?.sectionListRenderer, 'contents');
    }
  }
  add(r?.contents?.sectionListRenderer, 'contents');
  add(r?.continuationContents?.sectionListContinuation, 'contents');
  return lists;
}

// Before any filter runs: remember how many videos each row was sent with.
export function markRows(r) {
  for (const { holder, key } of contentLists(r)) {
    for (const shelf of holder[key]) {
      const list = rowList(shelf);
      if (list && list.ttRowSize === undefined) list.ttRowSize = list.items.length;
    }
  }
  return r;
}

function browseIdOf(r) {
  for (const service of r?.responseContext?.serviceTrackingParams || []) {
    const param = (service?.params || []).find(p => p?.key === 'browse_id');
    if (param) return String(param.value || '');
  }
  return '';
}

// Subscriptions opens with a sideways "Most relevant" row above the "All
// subscriptions" grid; it repeats videos from the grid. Runs before the other
// filters, so duplicates are no longer taken out of the grid because of it.
export function hideRelevantRow(r, enabled) {
  if (!enabled || !r || typeof r !== 'object') return r;
  if (!/FEsubscriptions/.test(browseIdOf(r)) && !/FEsubscriptions/.test(window.location?.hash || '')) return r;
  for (const { holder, key } of contentLists(r)) {
    holder[key] = holder[key].filter((shelf, index, shelves) => {
      const list = rowList(shelf);
      if (!list || !titled(shelf) || shelf.shelfRenderer.tvhtml5ShelfRendererType === 'TVHTML5_SHELF_RENDERER_TYPE_SHORTS') return true;
      const next = shelves[index + 1];
      const beforeGrid = rowList(next) && titled(next) && (rowList(next).ttRowSize ?? rowList(next).items.length) <= MAX_GRID_ROW;
      const relevant = /relevant/i.test(titleOf(shelf)) || (beforeGrid && (list.ttRowSize ?? list.items.length) > MAX_GRID_ROW);
      return !relevant;
    });
  }
  return r;
}

function runsOf(shelves) {
  const runs = [];
  let run = null;
  shelves.forEach((shelf, index) => {
    const list = rowList(shelf);
    // A grid's rows are untitled, or repeat the title of its first row.
    if (list && run && (!titled(shelf) || titleOf(shelf) === run.title)) {
      run.rows.push(index);
    } else {
      run = list ? { rows: [index], title: titleOf(shelf) } : null;
      if (run) runs.push(run);
    }
  });
  return runs;
}

function reflowList(holder, key, continued, more) {
  const shelves = holder[key];
  const runs = runsOf(shelves);
  const remove = new Set();
  runs.forEach((run, runIndex) => {
    const lists = run.rows.map(index => rowList(shelves[index]));
    const capacity = Math.max(...lists.map(list => list.ttRowSize || 0));
    const firstRunContinues = continued && runIndex === 0 && run.rows[0] === 0 && !titled(shelves[0]);
    const isGrid = capacity > 1 && capacity <= MAX_GRID_ROW && (run.rows.length > 1 || firstRunContinues);
    if (!isGrid) return;
    let items = lists.flatMap(list => list.items);
    if (firstRunContinues && carry && carry.capacity === capacity) {
      items = carry.items.concat(items);
      carry = null;
    }
    const lastRun = runIndex === runs.length - 1 && run.rows[run.rows.length - 1] === shelves.length - 1;
    if (lastRun && more && items.length % capacity) {
      // More rows are coming: finish this page with full rows only.
      const keep = items.length - (items.length % capacity);
      carry = { items: items.slice(keep), capacity, template: shelves[run.rows[run.rows.length - 1]] };
      items = items.slice(0, keep);
    }
    lists.forEach((list, row) => {
      list.items = items.slice(row * capacity, (row + 1) * capacity);
      if (!list.items.length) remove.add(run.rows[row]);
    });
    // More videos than rows (the carried remainder): add rows like the last one.
    const extra = items.slice(lists.length * capacity);
    const template = shelves[run.rows[run.rows.length - 1]];
    const added = [];
    for (let start = 0; start < extra.length; start += capacity) {
      const copy = JSON.parse(JSON.stringify({ ...template, shelfRenderer: { ...template.shelfRenderer, title: undefined } }));
      rowList(copy).items = extra.slice(start, start + capacity);
      added.push(copy);
    }
    if (added.length) run.added = added;
  });
  // Rows that filters emptied and no refill reached.
  shelves.forEach((shelf, index) => {
    const list = rowList(shelf);
    if (list && !list.items.length && list.ttRowSize > 0) remove.add(index);
  });
  const result = [];
  shelves.forEach((shelf, index) => {
    if (!remove.has(index)) result.push(shelf);
    const run = runs.find(r => r.rows[r.rows.length - 1] === index);
    if (run?.added) result.push(...run.added);
  });
  // A held-back remainder whose next page starts with something else.
  if (continued && carry && !(rowList(result[0]) && !titled(result[0]))) {
    const copy = JSON.parse(JSON.stringify({ ...carry.template, shelfRenderer: { ...carry.template.shelfRenderer, title: undefined } }));
    rowList(copy).items = carry.items;
    result.unshift(copy);
    carry = null;
  }
  holder[key] = result;
}

export function reflowRows(r) {
  if (!r || typeof r !== 'object') return r;
  const continued = !!r.continuationContents?.sectionListContinuation;
  if (!continued && contentLists(r).length) carry = null;
  for (const { holder, key } of contentLists(r)) {
    const more = !!(holder.continuations && holder.continuations.length);
    reflowList(holder, key, continued, more);
  }
  return r;
}
