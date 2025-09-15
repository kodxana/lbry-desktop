// @flow
import * as ICONS from 'constants/icons';
import * as PAGES from 'constants/pages';
import React from 'react';
import Button from 'component/button';
import Card from 'component/common/card';
import Icon from 'component/common/icon';
import Page from 'component/page';
import Spinner from 'component/spinner';
import DownloadList from 'page/fileListDownloaded';
import { useHistory } from 'react-router';

// https://github.com/lbryio/lbry-sdk/issues/2964
export const PURCHASES_PAGE_SIZE = 10;

type Props = {
  activeDownloadCount: number,
  allDownloadedUrlsCount: number,
  myPurchases: Array<string>,
  fetchingMyPurchases: boolean,
  fetchingFileList: boolean,
  doPurchaseList: (number, number) => void,
};

function LibraryPage(props: Props) {
  const {
    activeDownloadCount,
    allDownloadedUrlsCount,
    myPurchases,
    fetchingMyPurchases,
    fetchingFileList,
    doPurchaseList,
  } = props;
  const { location } = useHistory();
  const urlParams = new URLSearchParams(location.search);
  const page = Number(urlParams.get('page')) || 1;
  const purchasesCount = (myPurchases && myPurchases.length) || 0;
  const downloadsCount = allDownloadedUrlsCount || 0;
  const loading = fetchingFileList || fetchingMyPurchases;

  React.useEffect(() => {
    doPurchaseList(page, PURCHASES_PAGE_SIZE);
  }, [doPurchaseList, page]);

  const stats = [
    {
      icon: ICONS.DOWNLOAD,
      label: __('Downloads'),
      value: downloadsCount.toLocaleString(),
    },
    {
      icon: ICONS.PURCHASED,
      label: __('Purchases'),
      value: purchasesCount.toLocaleString(),
    },
    {
      icon: ICONS.TIME,
      label: __('Active downloads'),
      value: (activeDownloadCount || 0).toLocaleString(),
    },
  ];

  return (
    <Page className="library-page" noFooter>
      <Card
        className="library-page__hero"
        body={
          <div className="library-page__hero-content">
            <div className="library-page__hero-text">
              <Icon icon={ICONS.LIBRARY} size={24} />
              <div>
                <h1 className="library-page__title">{__('Library')}</h1>
                <p className="library-page__subtitle">
                  {__('Keep track of everything you have downloaded or purchased on LBRY.')}
                </p>
              </div>
            </div>
          </div>
        }
      />

      <div className="library-page__stats">
        {stats.map((item) => (
          <div key={item.label} className="library-page__stat">
            <div className="library-page__stat-icon">
              <Icon icon={item.icon} size={20} />
            </div>
            <div className="library-page__stat-copy">
              <span className="library-page__stat-count">{item.value}</span>
              <span className="library-page__stat-label">{item.label}</span>
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="library-page__loading">
          <Spinner delayed />
          <span>{__('Refreshing your library...')}</span>
        </div>
      )}

      <DownloadList />
    </Page>
  );
}

export default LibraryPage;
