import { connect } from 'react-redux';
import DownloadManager from './view';
import { selectDownloadingFileInfos } from 'redux/selectors/file_info';
import { buildURI } from 'util/lbryURI';

const select = (state) => {
  const infos = selectDownloadingFileInfos(state) || [];
  const uris = infos
    .map((fi) =>
      buildURI({ streamName: fi.claim_name, channelName: fi.channel_name, channelClaimId: fi.channel_claim_id })
    )
    .filter(Boolean);
  return { uris };
};

export default connect(select, null)(DownloadManager);
