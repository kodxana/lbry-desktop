// @flow
import * as ICONS from 'constants/icons';
import React from 'react';
import usePersistedState from 'effects/use-persisted-state';
import Button from 'component/button';
import Card from 'component/common/card';
import ClaimList from 'component/claimList';
import Paginate from 'component/common/paginate';
import { PAGE_SIZE } from 'constants/claim';
import Icon from 'component/common/icon';
import { withRouter } from 'react-router';
import classnames from 'classnames';
import { PURCHASES_PAGE_SIZE } from 'page/library/view';
import Spinner from 'component/spinner';

type Props = {
  fetchingFileList: boolean,
  downloadedUrls: Array<string>,
  downloadedUrlsCount: ?number,
  history: { replace: (string) => void },
  query: string,
  doPurchaseList: () => void,
  myDownloads: Array<string>,
  myPurchases: Array<string>,
  myPurchasesCount: ?number,
  fetchingMyPurchases: boolean,
};

const VIEW_DOWNLOADS = 'view_download';
const VIEW_PURCHASES = 'view_purchases';

function FileListDownloaded(props: Props) {
  const {
    history,
    query,
    downloadedUrlsCount,
    myPurchasesCount,
    myPurchases,
    myDownloads,
    fetchingFileList,
    fetchingMyPurchases,
  } = props;
  const loading = fetchingFileList || fetchingMyPurchases;
  const [viewMode, setViewMode] = usePersistedState('library-view-mode', VIEW_PURCHASES);

  function handleInputChange(e) {
    const { value } = e.target;
    if (value !== query) {
      history.replace(`?query=${value}&page=1`);
    }
  }

  const isDownloadsView = viewMode === VIEW_DOWNLOADS;
  const activeUris = isDownloadsView ? myDownloads : myPurchases;
  const totalItemCount = Number(isDownloadsView ? downloadedUrlsCount || 0 : myPurchasesCount || 0);
  const visibleCount = activeUris ? activeUris.length : 0;
  const pageSize = isDownloadsView ? PAGE_SIZE : PURCHASES_PAGE_SIZE;

  const title = isDownloadsView ? __('Downloads') : __('Purchases');
  const subtitle = query
    ? __('Showing %count% results', { count: visibleCount })
    : __('%count% items', { count: totalItemCount });

  const emptyLabel = isDownloadsView
    ? query
      ? __('No downloads match %query%', { query })
      : __('Files you download will appear here.')
    : query
    ? __('No purchases match %query%', { query })
    : __('You have not purchased anything yet.');

  const totalPages = Math.max(1, Math.ceil(totalItemCount / Number(pageSize || 1)));

  return (
    <Card
      className="library-page__list"
      title={title}
      subtitle={subtitle}
      isBodyList
      titleActions={
        <div className="library-page__controls">
          <div className="library-page__toggle-group">
            <Button
              icon={ICONS.LIBRARY}
              label={__('Downloads')}
              className={classnames('button-toggle', {
                'button-toggle--active': isDownloadsView,
              })}
              onClick={() => setViewMode(VIEW_DOWNLOADS)}
              aria-pressed={isDownloadsView}
            />
            <Button
              icon={ICONS.PURCHASED}
              label={__('Purchases')}
              className={classnames('button-toggle', {
                'button-toggle--active': !isDownloadsView,
              })}
              onClick={() => setViewMode(VIEW_PURCHASES)}
              aria-pressed={!isDownloadsView}
            />
          </div>
          {loading && (
            <span className="library-page__controls-spinner">
              <Spinner type="small" />
            </span>
          )}
          <form
            onSubmit={(event) => event.preventDefault()}
            className="library-page__search"
            role="search"
            aria-label={__('Search library')}
          >
            <Icon icon={ICONS.SEARCH} size={18} />
            <input
              className="library-page__search-input"
              onChange={handleInputChange}
              value={query}
              type="search"
              name="query"
              placeholder={__('Search library')}
            />
          </form>
        </div>
      }
      body={
        <div className="library-page__list-body">
          <ClaimList
            tileLayout
            uris={activeUris}
            loading={loading}
            renderProperties={() => null}
            header={false}
            empty={emptyLabel}
          />
          {!query && totalPages > 1 && <Paginate totalPages={totalPages} />}
        </div>
      }
    />
  );
}

export default withRouter(FileListDownloaded);
