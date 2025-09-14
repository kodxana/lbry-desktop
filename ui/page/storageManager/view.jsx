// @flow
import * as ICONS from 'constants/icons';
import * as PAGES from 'constants/pages';
import { PAGE_TITLE } from 'constants/pageTitles';
import React from 'react';
import Lbry from 'lbry';
import Page from 'component/page';
import Card from 'component/common/card';
import Button from 'component/button';
import Icon from 'component/common/icon';
import ClaimList from 'component/claimList';
import Paginate from 'component/common/paginate';
import usePersistedState from 'effects/use-persisted-state';
import { FormField } from 'component/common/form';

type InventoryTotals = {
  network_storage: number,
  content_storage: number,
  private_storage: number,
  total: number,
};

type InventoryEntry = {
  claim_id?: string,
  name?: string,
  url?: string,
  sd_hash?: string,
  stream_hash?: string,
  saved_file?: boolean,
  pinned?: boolean,
  blobs_present?: number,
  blobs_total?: number,
  size_mb?: number,
};

const uniq = (arr: Array<string>) => Array.from(new Set(arr));

const PAGE_SIZE = 20;

export default function StorageManager(): React$Node {
  const [totals, setTotals] = React.useState<?InventoryTotals>(null);
  const [entries, setEntries] = React.useState<Array<InventoryEntry>>([]);
  const [pinnedUris, setPinnedUris] = React.useState<Array<string>>([]);
  const [uris, setUris] = React.useState<Array<string>>([]);
  const [resolvedByUri, setResolvedByUri] = React.useState<{ [string]: any }>({});
  const [labelsByHash, setLabelsByHash] = React.useState<{ [string]: { title?: string, channel?: string } }>({});
  const [loading, setLoading] = React.useState(false);

  const [localOnly, setLocalOnly] = usePersistedState('sm-local-only', true);
  const [showGrid, setShowGrid] = usePersistedState('sm-grid', true);
  const [grouped, setGrouped] = usePersistedState('sm-group', true);
  const [search, setSearch] = React.useState('');
  const [pageUris, setPageUris] = React.useState(1);
  const [pageUnmapped, setPageUnmapped] = React.useState(1);

  const makeUri = (name, claimId, url) => (url ? url : name && claimId ? `lbry://${name}#${claimId}` : null);

  const refresh = React.useCallback(() => {
    setLoading(true);
    Promise.all([Lbry.storage_pins(), Lbry.storage_inventory({ sort: 'size' })])
      .then(([pinsRes, inv]) => {
        const pins: Array<any> = pinsRes || [];
        const claims: Array<InventoryEntry> = (inv && inv.claims) || [];
        const totalsObj: ?InventoryTotals = (inv && inv.totals) || null;

        const hosted = claims.filter((c) =>
          localOnly
            ? (c.blobs_present || 0) > 0 || (c.size_mb || 0) > 0
            : (c.blobs_present || 0) > 0 || (c.size_mb || 0) > 0 || c.pinned || c.saved_file
        );

        const listUris = hosted.map((c) => makeUri(c.name, c.claim_id, c.url)).filter(Boolean);
        const pinUris = pins.map((p) => makeUri(p.name, p.claim_id, p.url)).filter(Boolean);

        setTotals(totalsObj || null);
        setEntries(hosted);
        setUris(uniq(listUris));
        setPinnedUris(uniq(pinUris));

        if (listUris.length) {
          Lbry.resolve({ urls: uniq(listUris) })
            .then((res) => setResolvedByUri(res || {}))
            .catch(() => setResolvedByUri({}));
        } else {
          setResolvedByUri({});
        }
      })
      .finally(() => setLoading(false));
  }, [localOnly]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  // Hydrate entries that only have hashes so we can show them as tiles
  React.useEffect(() => {
    const unmapped = entries.filter((e) => !makeUri(e.name, e.claim_id, e.url));
    const toFetch = unmapped.filter(
      (e) => !(e.sd_hash && labelsByHash[e.sd_hash || '']) && !(e.stream_hash && labelsByHash[e.stream_hash || ''])
    );
    if (!toFetch.length) return;
    (async () => {
      const newLabels = { ...labelsByHash };
      const discovered: Array<string> = [];
      for (const it of toFetch) {
        try {
          const params: any = { page: 1, page_size: 1 };
          if (it.sd_hash) params.sd_hash = it.sd_hash;
          else if (it.stream_hash) params.stream_hash = it.stream_hash;
          const res = await Lbry.file_list(params);
          const item = (res && res.items && res.items[0]) || (Array.isArray(res) ? res[0] : null);
          if (item) {
            const title = (item.metadata && item.metadata.title) || item.claim_name || it.name;
            const channel = item.channel_name || (item.signing_channel && item.signing_channel.name);
            const key = it.sd_hash || it.stream_hash;
            if (key) newLabels[key] = { title, channel };
            const url =
              item.permanent_url ||
              (item.claim_name && item.claim_id ? `lbry://${item.claim_name}#${item.claim_id}` : null);
            if (url) discovered.push(url);
          }
        } catch (e) {}
      }
      if (Object.keys(newLabels).length !== Object.keys(labelsByHash).length) setLabelsByHash(newLabels);
      if (discovered.length) setUris((prev) => uniq([...(prev || []), ...discovered]));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length]);

  const lc = (s) => (s || '').toLowerCase();
  const filterBySearch = (uri: string) => {
    if (!search) return true;
    const r = resolvedByUri[uri] || {};
    const title = (r.value && r.value.title) || r.name || '';
    const channel = (r.signing_channel && r.signing_channel.name) || '';
    return lc(uri).includes(lc(search)) || lc(title).includes(lc(search)) || lc(channel).includes(lc(search));
  };

  const filteredUris = uniq(uris).filter(filterBySearch);

  // Helpers to interpret resolve() results across possible shapes
  const getResolved = React.useCallback(
    (uri: string) => {
      const m = resolvedByUri || {};
      const direct = m[uri];
      const fromResults = m.results && m.results[uri];
      const entry = direct || fromResults || null;
      // Some shapes return { claim: {...} }
      return entry && entry.claim ? entry.claim : entry;
    },
    [resolvedByUri]
  );

  const getChannelName = React.useCallback(
    (uri: string) => {
      const r = getResolved(uri) || {};
      const chObj =
        (r && r.signing_channel) ||
        (r && r.value && r.value.signing_channel) ||
        (r && r.meta && r.meta.signing_channel) ||
        null;
      let chName = (chObj && chObj.name) || '';
      if (!chName && chObj && chObj.canonical_url) {
        const m = /lbry:\/\/(\@[A-Za-z0-9_\-\.]+)/.exec(chObj.canonical_url);
        if (m && m[1]) chName = m[1];
      }
      if (!chName) {
        const m = /lbry:\/\/(\@[A-Za-z0-9_\-\.]+)/.exec(uri);
        if (m && m[1]) chName = m[1];
      }
      return chName || 'Unspecified';
    },
    [getResolved]
  );

  const renderProperties = React.useCallback(
    (claim) => {
      if (!claim) return null;
      const info = entries.find((e) => e.claim_id === claim.claim_id);
      if (!info) return null;
      const blobs =
        typeof info.blobs_present === 'number' && typeof info.blobs_total === 'number'
          ? `${info.blobs_present}/${info.blobs_total}`
          : '-';
      const size = info.size_mb ? `${info.size_mb} MB` : '-';
      const saved = info.saved_file ? 'Saved' : 'Not saved';
      const pinned = info.pinned ? 'Pinned' : 'Not pinned';
      return <div className="media__subtitle">{`Blobs: ${blobs} | Size: ${size} | ${saved} | ${pinned}`}</div>;
    },
    [entries]
  );

  const renderActions = React.useCallback(
    (claim) => {
      if (!claim) return null;
      const isPinned = entries.some((e) => e.claim_id === claim.claim_id && e.pinned);
      const toggle = isPinned ? Lbry.storage_unpin : Lbry.storage_pin;
      const label = isPinned ? 'Unpin' : 'Pin';
      const icon = isPinned ? ICONS.UNLOCK : ICONS.LOCK;
      return (
        <div className="claim-preview__primary-actions">
          <Button
            icon={icon}
            button="alt"
            label={label}
            onClick={() => toggle({ claim_id: claim.claim_id }).then(refresh)}
          />
        </div>
      );
    },
    [entries, refresh]
  );

  const groupedCards = React.useMemo(() => {
    if (!grouped) return null;
    const groups: { [string]: Array<string> } = {};
    filteredUris.forEach((uri) => {
      const ch = getChannelName(uri);
      if (!groups[ch]) groups[ch] = [];
      groups[ch].push(uri);
    });
    const ordered = Object.keys(groups).sort();
    if (!ordered.length) return <div className="help">No stored claims</div>;
    return ordered.map((ch) => (
      <Card
        key={ch}
        title={`${ch} — ${groups[ch].length}`}
        isBodyList
        body={
          <ClaimList
            uris={groups[ch]}
            header={false}
            empty={'No stored claims'}
            renderActions={renderActions}
            renderProperties={renderProperties}
            showHiddenByUser
            tileLayout={showGrid}
          />
        }
      />
    ));
  }, [grouped, filteredUris, getChannelName, showGrid, renderActions, renderProperties]);

  const unmapped = entries.filter((e) => !makeUri(e.name, e.claim_id, e.url));

  return (
    <Page>
      <div className={`card-stack ${showGrid ? 'storage-manager--grid' : ''}`}>
        <div className="section__header--actions">
          <h1 className="card__title">
            <Icon icon={ICONS.STACK} /> {__(PAGE_TITLE[PAGES.STORAGE_MANAGER])}
          </h1>
          <div className="section__actions--inline">
            <Button
              button="alt"
              icon={ICONS.FILTER}
              label={localOnly ? 'Local Only' : 'All Hosted'}
              onClick={() => {
                setLocalOnly(!localOnly);
                setPageUris(1);
                setPageUnmapped(1);
                refresh();
              }}
            />
            <Button button="alt" icon={ICONS.REFRESH} label={'Refresh'} onClick={refresh} />
            <Button
              button="alt"
              icon={ICONS.LAYOUT}
              label={showGrid ? 'Grid' : 'List'}
              onClick={() => setShowGrid(!showGrid)}
            />
            <Button
              button="alt"
              icon={ICONS.LAYOUT}
              label={grouped ? 'Grouped' : 'Ungrouped'}
              onClick={() => setGrouped(!grouped)}
            />
            <FormField
              type="text"
              name="storage-search"
              className="paginate-goto"
              placeholder={'Search (title, channel, url)'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Card
          isBodyList
          body={
            <div className="section">
              {totals && (
                <div className="section__subtitle">{`Network: ${totals.network_storage || 0} MB | Content: ${
                  totals.content_storage || 0
                } MB | Private: ${totals.private_storage || 0} MB | Total: ${totals.total || 0} MB`}</div>
              )}
              {loading && <div className="help">Loading...</div>}
            </div>
          }
        />

        <Card
          title={'Pinned Claims'}
          isBodyList
          body={
            <ClaimList
              uris={pinnedUris}
              header={false}
              empty={'No pins'}
              renderActions={renderActions}
              renderProperties={renderProperties}
              showHiddenByUser
              tileLayout={showGrid}
            />
          }
        />

        <Card
          title={'All Stored Claims'}
          isBodyList
          body={
            <>
              {grouped ? (
                groupedCards
              ) : (
                <>
                  <ClaimList
                    uris={filteredUris.slice((pageUris - 1) * PAGE_SIZE, pageUris * PAGE_SIZE)}
                    header={false}
                    empty={'No stored claims'}
                    renderActions={renderActions}
                    renderProperties={renderProperties}
                    showHiddenByUser
                    tileLayout={showGrid}
                  />
                  <Paginate
                    totalPages={Math.max(1, Math.ceil(filteredUris.length / PAGE_SIZE))}
                    onPageChange={setPageUris}
                    disableHistory
                  />

                  {unmapped.length > 0 && (
                    <>
                      <div className="table table--stretch">
                        <div className="table__header">
                          <div>Title</div>
                          <div>Channel</div>
                          <div>Blobs</div>
                          <div>Size</div>
                          <div className="table__actions" />
                        </div>
                        <div className="table__rows">
                          {unmapped.slice((pageUnmapped - 1) * PAGE_SIZE, pageUnmapped * PAGE_SIZE).map((it, idx) => (
                            <div key={`${it.stream_hash || it.sd_hash || idx}`} className="table__row">
                              <div>
                                {(it.sd_hash && labelsByHash[it.sd_hash] && labelsByHash[it.sd_hash].title) ||
                                  it.name ||
                                  it.sd_hash ||
                                  it.stream_hash}
                              </div>
                              <div>
                                {(it.sd_hash && labelsByHash[it.sd_hash] && labelsByHash[it.sd_hash].channel) || '-'}
                              </div>
                              <div>
                                {typeof it.blobs_present === 'number' && typeof it.blobs_total === 'number'
                                  ? `${it.blobs_present}/${it.blobs_total}`
                                  : '-'}
                              </div>
                              <div>{it.size_mb ? `${it.size_mb} MB` : '-'}</div>
                              <div className="table__actions">
                                <Button
                                  icon={it.pinned ? ICONS.UNLOCK : ICONS.LOCK}
                                  label={it.pinned ? 'Unpin' : 'Pin'}
                                  onClick={() =>
                                    (it.pinned
                                      ? Lbry.storage_unpin({ sd_hash: it.sd_hash })
                                      : Lbry.storage_pin({ sd_hash: it.sd_hash })
                                    ).then(refresh)
                                  }
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Paginate
                        totalPages={Math.max(1, Math.ceil(unmapped.length / PAGE_SIZE))}
                        onPageChange={setPageUnmapped}
                        disableHistory
                      />
                    </>
                  )}
                </>
              )}
            </>
          }
        />
      </div>
    </Page>
  );
}
