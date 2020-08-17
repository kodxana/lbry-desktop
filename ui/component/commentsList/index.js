import { connect } from 'react-redux';
import { makeSelectClaimIsMine, selectMyChannelClaims } from 'lbry-redux';
import { makeSelectTopLevelCommentsForUri, selectIsFetchingComments } from 'redux/selectors/comments';
import { doCommentList } from 'redux/actions/comments';
import { withRouter } from 'react-router';

import CommentsList from './view';

const select = (state, props) => {
  return {
    myChannels: selectMyChannelClaims(state),
    comments: makeSelectTopLevelCommentsForUri(props.uri)(state),
    claimIsMine: makeSelectClaimIsMine(props.uri)(state),
    isFetchingComments: selectIsFetchingComments(state),
  };
};
const perform = dispatch => ({
  fetchComments: uri => dispatch(doCommentList(uri)),
});

export default withRouter(connect(select, perform)(CommentsList));
