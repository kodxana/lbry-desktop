// @flow
import React from 'react';
import HostingSplash from 'component/hostingSplash';
import HostingSplashCustom from 'component/hostingSplashCustom';
import WelcomeSplash from 'component/welcomeSplash';
import Page from 'component/page';
import { useHistory } from 'react-router-dom';

const SPLASH_PAGE = 0;
// Privacy page removed; skip directly to hosting pages.
const HOSTING_PAGE = 1;
const HOSTING_ADVANCED = 2;

type DaemonStatus = {
  disk_space: {
    content_blobs_storage_used_mb: string,
    published_blobs_storage_used_mb: string,
    running: true,
    seed_blobs_storage_used_mb: string,
    total_used_mb: string,
  },
};

type DaemonSettings = {
  download_dir: string,
  share_usage_data: boolean,
  max_connections_per_download?: number,
  save_files: boolean,
  save_blobs: boolean,
  ffmpeg_path: string,
};

type Props = {
  // --- select ---
  daemonSettings: DaemonSettings,
  daemonStatus: DaemonStatus,
  // -- perform ---
  updateWelcomeVersion: () => void,
};
export default function Welcome(props: Props) {
  const { updateWelcomeVersion } = props;
  // const { save_blobs: saveBlobs } = daemonSettings || {};
  const [welcomePage, setWelcomePage] = React.useState(SPLASH_PAGE);
  const { replace } = useHistory();

  const handleNextPage = () => {
    if (welcomePage === SPLASH_PAGE) {
      setWelcomePage(HOSTING_PAGE);
    } else if (welcomePage === HOSTING_PAGE) {
      setWelcomePage(HOSTING_ADVANCED);
    }
  };

  const handleGoBack = () => {
    if (welcomePage >= 1) {
      setWelcomePage(welcomePage - 1);
    }
  };

  const handleDone = () => {
    updateWelcomeVersion();
    replace('/');
  };

  return (
    <Page noHeader noSideNavigation>
      {welcomePage === SPLASH_PAGE && <WelcomeSplash handleNextPage={handleNextPage} />}
      {welcomePage === HOSTING_PAGE && <HostingSplash handleNextPage={handleNextPage} handleDone={handleDone} />}
      {welcomePage === HOSTING_ADVANCED && (
        <HostingSplashCustom handleNextPage={handleDone} handleGoBack={handleGoBack} />
      )}
    </Page>
  );
}
