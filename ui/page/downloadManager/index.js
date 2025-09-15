import { connect } from 'react-redux';
import DownloadManager from './view';
import { selectClaimsByUri } from 'redux/selectors/claims';
import { doResolveUris } from 'redux/actions/claims';

const select = (state) => ({
  claimsByUri: selectClaimsByUri(state),
});

const perform = (dispatch) => ({
  doResolveUris: (uris) => dispatch(doResolveUris(uris, true)),
});

export default connect(select, perform)(DownloadManager);
