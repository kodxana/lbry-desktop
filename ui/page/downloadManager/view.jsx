// @flow
import * as ICONS from 'constants/icons';
import * as PAGES from 'constants/pages';
import { PAGE_TITLE } from 'constants/pageTitles';
import React from 'react';
import Page from 'component/page';
import Card from 'component/common/card';
import Button from 'component/button';
import Icon from 'component/common/icon';
import Lbry from 'lbry';
import Paginate from 'component/common/paginate';
import { useHistory } from 'react-router';
import { formatBytes } from 'util/format-bytes';
import { buildURI } from 'util/lbryURI';

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
  metadata?: ?{
    title?: string,
    source?: ?{
      size?: number,
    },
  },
  file_name?: string,
  download_path?: string,
  uri?: string,
};

type DownloadMetric = {
  speed: number,
  writtenBytes: number,
  totalBytes: number,
  timestamp: number,
};

type Props = {
  claimsByUri: { [string]: ?Claim },
  doResolveUris: (Array<string>) => void,
};

function formatEta(seconds: number) {
  if (!isFinite(seconds) || seconds <= 0) {
    return '--';
  }

  const totalSeconds = Math.ceil(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function getStatusLabel(file: FileItem, percent: number) {
  const normalized = (file.status || '').toLowerCase();

  switch (normalized) {
    case 'running':
      return __('Downloading');
    case 'stopped':
      return __('Paused');
    case 'finished':
    case 'completed':
      return __('Completed');
    case 'seeding':
      return __('Seeding');
    case 'error':
    case 'failed':
      return __('Error');
    case 'queued':
    case 'pending':
      return __('Queued');
    default:
      break;
  }

  if (file.completed || percent >= 100) {
    return __('Completed');
  }

  if (file.blobs_remaining !== undefined && file.blobs_remaining > 0) {
    return __('Paused');
  }

  return file.status ? file.status : __('Queued');
}

export default function DownloadManager(props: Props): React$Node {
  const { claimsByUri, doResolveUris } = props;
  const [items, setItems] = React.useState<Array<FileItem>>([]);
  const [incompleteUris, setIncompleteUris] = React.useState<Array<string>>([]);
  const [metricsById, setMetricsById] = React.useState<{
    [string]: { speed: number, writtenBytes: number, totalBytes: number },
  }>({});
  const metricsRef = React.useRef<{ [string]: DownloadMetric }>({});
  const timerRef = React.useRef<?any>(null);
  const PAGE_SIZE = 20;
  const {
    location: { search },
  } = useHistory();
  const urlParams = new URLSearchParams(search);
  const urlParamPage = Number(urlParams.get('page')) || 1;
  const [currentPage, setCurrentPage] = React.useState<number>(urlParamPage);
  const fetchList = React.useCallback(() => {
    const now = Date.now();
    Lbry.file_list({ page_size: 999, full_status: true })
      .then((res) => {
        const rawList = (res && (res.items || res)) || [];
        const seenUris = new Set();
        const nextMetricsRef: { [string]: DownloadMetric } = {};
        const nextMetricsForState: {
          [string]: { speed: number, writtenBytes: number, totalBytes: number },
        } = {};
        const nextItems: Array<FileItem> = [];

        rawList.forEach((entry) => {
          const cid = entry.claim_id;
          if (!cid) {
            return;
          }

          let uri;
          if (entry.claim_name) {
            try {
              uri = buildURI({
                streamName: entry.claim_name,
                streamClaimId: cid,
                channelName: entry.channel_name,
                channelClaimId: entry.channel_claim_id,
              });
            } catch (e) {
              uri = undefined;
            }
          }

          const file: FileItem = { ...entry, uri };
          nextItems.push(file);

          if (!file.completed && uri) {
            seenUris.add(uri);
          }

          const written = Number(file.written_bytes) || 0;
          const total =
            Number(file.total_bytes) ||
            (file.metadata && file.metadata.source && Number(file.metadata.source.size)) ||
            0;
          const prev = metricsRef.current[cid];
          let speed = 0;
          if (prev && prev.timestamp) {
            const deltaBytes = written - prev.writtenBytes;
            const deltaTime = now - prev.timestamp;
            if (deltaBytes > 0 && deltaTime > 0) {
              speed = deltaBytes / (deltaTime / 1000);
            } else if (entry.status === 'running' && prev.speed) {
              speed = prev.speed;
            }
          }

          nextMetricsRef[cid] = { speed, writtenBytes: written, totalBytes: total, timestamp: now };
          nextMetricsForState[cid] = { speed, writtenBytes: written, totalBytes: total };
        });

        metricsRef.current = nextMetricsRef;
        setMetricsById(nextMetricsForState);
        setItems(nextItems);
        setIncompleteUris(Array.from(seenUris));
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    fetchList();
    timerRef.current = setInterval(fetchList, 2000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [fetchList]);

  React.useEffect(() => {
    const qp = Number(new URLSearchParams(search).get('page')) || 1;
    setCurrentPage(qp);
  }, [search]);

  React.useEffect(() => {
    if (incompleteUris.length > 0) {
      doResolveUris(incompleteUris);
    }
  }, [incompleteUris, doResolveUris]);

  const inProgressItems = React.useMemo(() => {
    const filtered = items.filter((file) => !file.completed);

    filtered.sort((a, b) => {
      const priority = (file) => {
        if (file.status === 'running') return 0;
        if (file.status === 'stopped') return 1;
        return 2;
      };

      const diff = priority(a) - priority(b);
      if (diff !== 0) return diff;

      return (b.written_bytes || 0) - (a.written_bytes || 0);
    });

    return filtered;
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(inProgressItems.length / PAGE_SIZE));

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagedItems = React.useMemo(
    () => inProgressItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [inProgressItems, currentPage]
  );

  const renderActions = React.useCallback(
    (file: FileItem) => {
      const cid = file.claim_id;
      if (!cid) return null;

      const isRunning = file.status === 'running';
      const isCompleted = Boolean(file.completed);

      return (
        <div className="download-manager__actions">
          <Button
            icon={ICONS.BLOCK}
            button="alt"
            title={__('Pause')}
            aria-label={__('Pause download')}
            disabled={!isRunning}
            onClick={() => Lbry.file_set_status({ status: 'stop', claim_id: cid })}
          />
          <Button
            icon={ICONS.PLAY}
            button="alt"
            title={__('Resume')}
            aria-label={__('Resume download')}
            disabled={isRunning || isCompleted}
            onClick={() => Lbry.file_set_status({ status: 'start', claim_id: cid })}
          />
          <Button
            icon={ICONS.DELETE}
            button="alt"
            title={__('Remove')}
            aria-label={__('Remove download')}
            onClick={() => Lbry.file_delete({ delete_from_download_dir: true, claim_id: cid })}
          />
        </div>
      );
    },
    []
  );

  const tableRows = pagedItems.map((file) => {
    if (!file.claim_id) return null;

    const claim = file.uri && claimsByUri ? claimsByUri[file.uri] : undefined;
    const signingChannel = claim && claim.signing_channel;
    const channelName = (signingChannel && signingChannel.name) || file.channel_name;
    const displayName =
      (claim && claim.value && claim.value.title) ||
      (file.metadata && file.metadata.title) ||
      file.claim_name ||
      file.file_name ||
      __('Untitled file');
    const downloadPath = file.download_path;
    const metric = metricsById[file.claim_id] || {};
    const writtenBytes =
      metric.writtenBytes !== undefined ? metric.writtenBytes : Number(file.written_bytes) || 0;
    const totalBytes =
      metric.totalBytes ||
      Number(file.total_bytes) ||
      (file.metadata && file.metadata.source && Number(file.metadata.source.size)) ||
      0;
    const totalBlobs = Number(file.blobs_in_stream) || 0;
    const remainingBlobs = Number(file.blobs_remaining) || 0;
    const doneBlobs = totalBlobs ? Math.max(0, totalBlobs - remainingBlobs) : 0;

    let percent = 0;
    if (totalBlobs) {
      percent = Math.floor((doneBlobs / totalBlobs) * 100);
    } else if (totalBytes) {
      percent = Math.floor((writtenBytes / totalBytes) * 100);
    } else if (file.completed) {
      percent = 100;
    }
    percent = Math.min(100, Math.max(0, percent));

    const speed = metric.speed || 0;
    const speedLabel = speed > 0 ? `${formatBytes(speed)}/s` : '--';
    const etaLabel = speed > 0 && totalBytes > 0 ? formatEta((totalBytes - writtenBytes) / speed) : '--';
    const sizeLabel = totalBytes > 0 ? formatBytes(totalBytes) : '--';
    const statusLabel = getStatusLabel(file, percent);
    const progressSubtitleParts = [];

    if (totalBytes > 0) {
      progressSubtitleParts.push(`${formatBytes(writtenBytes)} / ${formatBytes(totalBytes)}`);
    } else if (writtenBytes > 0) {
      progressSubtitleParts.push(formatBytes(writtenBytes));
    }

    if (totalBlobs > 0) {
      progressSubtitleParts.push(__('Blobs %done%/%total%', { done: String(doneBlobs), total: String(totalBlobs) }));
    }

    const progressSubtitle =
      progressSubtitleParts.length > 0 ? progressSubtitleParts.join(' • ') : __('Waiting for metadata');

    return (
      <div key={file.claim_id} className="download-manager__row">
        <div className="download-manager__cell download-manager__cell--name">
          <div className="download-manager__title" title={displayName}>
            {displayName}
          </div>
          <div className="download-manager__meta">
            {channelName && <span>{channelName}</span>}
            {downloadPath && (
              <span title={downloadPath} className="download-manager__path">
                {downloadPath}
              </span>
            )}
          </div>
        </div>
        <div className="download-manager__cell download-manager__cell--progress">
          <div className="download-manager__progress-bar">
            <div className="download-manager__progress-bar-value" style={{ width: `${percent}%` }} />
          </div>
          <div className="download-manager__progress-text">
            <span className="download-manager__progress-percent">
              {__('%percent%%', { percent: String(percent) })}
            </span>
            <span className="download-manager__progress-detail">{progressSubtitle}</span>
          </div>
        </div>
        <div className="download-manager__cell download-manager__cell--status">{statusLabel}</div>
        <div className="download-manager__cell download-manager__cell--speed">{speedLabel}</div>
        <div className="download-manager__cell download-manager__cell--eta">{etaLabel}</div>
        <div className="download-manager__cell download-manager__cell--size">{sizeLabel}</div>
        <div className="download-manager__cell download-manager__cell--actions">{renderActions(file)}</div>
      </div>
    );
  });

  const hasRows = pagedItems.length > 0;

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
            hasRows ? (
              <>
                <div className="download-manager__table">
                  <div className="download-manager__header">
                    <div className="download-manager__header-cell download-manager__cell--name">{__('Name')}</div>
                    <div className="download-manager__header-cell download-manager__cell--progress">{__('Progress')}</div>
                    <div className="download-manager__header-cell download-manager__cell--status">{__('Status')}</div>
                    <div className="download-manager__header-cell download-manager__cell--speed">{__('Speed')}</div>
                    <div className="download-manager__header-cell download-manager__cell--eta">{__('ETA')}</div>
                    <div className="download-manager__header-cell download-manager__cell--size">{__('Size')}</div>
                    <div className="download-manager__header-cell download-manager__cell--actions">{__('Actions')}</div>
                  </div>
                  {tableRows}
                </div>
                <Paginate totalPages={totalPages} onPageChange={setCurrentPage} />
              </>
            ) : (
              <div className="empty empty--centered">{__('No downloads are in progress or missing data')}</div>
            )
          }
        />
      </div>
    </Page>
  );
}
