// @flow
import * as ICONS from 'constants/icons';
import * as PAGES from 'constants/pages';
import { PAGE_TITLE } from 'constants/pageTitles';
import React from 'react';
import Page from 'component/page';
import Card from 'component/common/card';
import Button from 'component/button';
import Icon from 'component/common/icon';
import ClaimList from 'component/claimList';
import FileDownloadLink from 'component/fileDownloadLink';
import Lbry from 'lbry';
import Paginate from 'component/common/paginate';
import { useHistory } from 'react-router';
import usePersistedState from 'effects/use-persisted-state';

type FileItem = {
  claim_id?: string,
  claim_name?: string,
  channel_name?: string,
  channel_claim_id?: string,
  completed?: boolean,
  status?: string,
  blobs_in_stream?: number,
  blobs_remaining?: number,
  written_bytes?: number,
  total_bytes?: number,
};

type Props = { uris: Array<string> };

export default function DownloadManager(props: Props): React$Node {
  const [items, setItems] = React.useState<Array<FileItem>>([]);
  const [detailsById, setDetailsById] = React.useState<{ [string]: FileItem }>({});
  const [incompleteUris, setIncompleteUris] = React.useState<Array<string>>([]);
  const timerRef = React.useRef<?any>(null);
  const PAGE_SIZE = 20;
  const {
    location: { search },
  } = useHistory();
  const urlParams = new URLSearchParams(search);
  const urlParamPage = Number(urlParams.get('page')) || 1;
  const [currentPage, setCurrentPage] = React.useState<number>(urlParamPage);
  const [compact, setCompact] = usePersistedState('dm-compact', false);

  const fetchList = React.useCallback(() => {
    Lbry.file_list({ page_size: 999, full_status: true })
      .then((res) => {
        const list = (res && (res.items || res)) || [];
        setItems(list);
        const byId = {};
        const uris = [];
        list.forEach((it) => {
          const cid = it.claim_id;
          if (cid) byId[cid] = it;
          if (!it.completed) {
            const name = it.claim_name;
            const channel = it.channel_name;
            const channelId = it.channel_claim_id;
            // Build canonical-like URI best-effort
            const uri = name
              ? `${channel ? `${channel}::${channelId}/` : ''}lbry://${name}#${cid}`.replace(/^.*lbry:\/\//, 'lbry://')
              : null;
            if (uri) uris.push(uri);
          }
        });
        setDetailsById(byId);
        setIncompleteUris(uris);
      })
      .catch(() => {})
      .finally(() => {
        // no-op
      });
  }, [detailsById]);

  React.useEffect(() => {
    fetchList();
    timerRef.current = setInterval(fetchList, 2000);
    return () => timerRef.current && clearInterval(timerRef.current);
  }, [fetchList]);

  React.useEffect(() => {
    const qp = Number(new URLSearchParams(search).get('page')) || 1;
    setCurrentPage(qp);
  }, [search]);

  const renderActions = React.useCallback((claim) => {
    if (!claim) return null;
    const cid = claim.claim_id;
    const it = detailsById[cid];
    const isRunning = it && it.status === 'running';
    const isCompleted = it && it.completed;
    return (
      <div className="claim-preview__primary-actions">
        <FileDownloadLink
          uri={claim.canonical_url || claim.permanent_url}
          hideOpenButton
          hideDownloadStatus
          buttonType="alt"
          showLabel={false}
        />
        <Button
          icon={ICONS.BLOCK}
          button="alt"
          label={__('Pause')}
          disabled={!isRunning}
          onClick={() => Lbry.file_set_status({ status: 'stop', claim_id: cid })}
        />
        <Button
          icon={ICONS.PLAY}
          button="alt"
          label={__('Resume')}
          disabled={isRunning || isCompleted}
          onClick={() => Lbry.file_set_status({ status: 'start', claim_id: cid })}
        />
        <Button
          icon={ICONS.DELETE}
          button="alt"
          label={__('Remove')}
          onClick={() => Lbry.file_delete({ delete_from_download_dir: true, claim_id: cid })}
        />
      </div>
    );
  }, []);

  return (
    <Page>
      <div className="card-stack">
        <div className="section__header--actions">
          <h1 className="card__title">
            <Icon icon={ICONS.DOWNLOAD} /> {__(PAGE_TITLE[PAGES.DOWNLOAD_MANAGER])}
          </h1>
          <div className="section__actions--inline">
            <Button
              button="alt"
              icon={ICONS.LAYOUT}
              aria-label={compact ? __('Switch to normal view') : __('Switch to compact view')}
              title={compact ? __('Normal View') : __('Compact View')}
              onClick={() => setCompact(!compact)}
            />
            <Button
              button="alt"
              icon={ICONS.PLAY}
              label={__('Resume All')}
              onClick={() => {
                const toStart = items.filter((it) => !it.completed && it.status !== 'running' && it.claim_id);
                Promise.allSettled(
                  toStart.map((it) => Lbry.file_set_status({ status: 'start', claim_id: it.claim_id }))
                ).finally(fetchList);
              }}
            />
            <Button button="alt" icon={ICONS.REFRESH} label={__('Refresh')} onClick={fetchList} />
          </div>
        </div>

        <Card
          title={__('In-Progress or Missing')}
          isBodyList
          body={
            <div className={compact ? 'download-manager--compact' : undefined}>
              <ClaimList
                uris={incompleteUris.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)}
                header={false}
                empty={__('No downloads are in progress or missing data')}
                type={compact ? 'small' : undefined}
                hideMenu={compact}
                renderActions={compact ? undefined : renderActions}
                renderProperties={(claim) => {
                  if (!claim) return null;
                  const it = detailsById[claim.claim_id];
                  if (!it) return null;
                  const total = it.blobs_in_stream || 0;
                  const remaining = it.blobs_remaining || 0;
                  const done = total ? total - remaining : 0;
                  const pct = total
                    ? Math.floor((done / total) * 100)
                    : it.total_bytes && it.written_bytes
                    ? Math.floor((it.written_bytes / it.total_bytes) * 100)
                    : it.completed
                    ? 100
                    : 0;
                  const blobsTxt = total ? `${done}/${total}` : '—';
                  const status =
                    it.status || (it.completed ? __('Completed') : remaining > 0 ? __('Stopped') : __('Queued'));
                  return (
                    <>
                      <div className="media__subtitle">
                        {__('%percent%% downloaded', { percent: String(pct) })} • {__('Blobs: %b%', { b: blobsTxt })} •{' '}
                        {status}
                      </div>
                      <div style={{ width: '100%', maxWidth: compact ? '100%' : '260px', marginTop: '4px' }}>
                        <div
                          style={{
                            background: 'var(--color-header-background)',
                            height: '4px',
                            borderRadius: '3px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: 'var(--color-primary)',
                            }}
                          />
                        </div>
                      </div>
                    </>
                  );
                }}
                showHiddenByUser
              />
              <Paginate
                totalPages={Math.max(1, Math.ceil(incompleteUris.length / PAGE_SIZE))}
                onPageChange={setCurrentPage}
              />
            </div>
          }
        />
      </div>
    </Page>
  );
}
