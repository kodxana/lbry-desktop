import { connect } from 'react-redux';
import { doPrepareEdit, makeSelectClaimForUri, makeSelectMetadataForUri, makeSelectTagsForUri } from 'lbry-redux';
import { selectUser } from 'redux/selectors/user';
import FileDescription from './view';
import { doOpenModal } from 'redux/actions/app';
import fs from 'fs';

const select = (state, props) => ({
  claim: makeSelectClaimForUri(props.uri)(state),
  metadata: makeSelectMetadataForUri(props.uri)(state),
  user: selectUser(state),
  tags: makeSelectTagsForUri(props.uri)(state),
});

const perform = dispatch => ({
  openModal: (modal, props) => dispatch(doOpenModal(modal, props)),
  prepareEdit: (publishData, uri, fileInfo) => dispatch(doPrepareEdit(publishData, uri, fileInfo, fs)),
});

export default connect(select, perform)(FileDescription);
