// @flow
import React from 'react';
import Comment from 'component/comment';
import Button from 'component/button';
import * as ICONS from 'constants/icons';

type Props = {
  comments: Array<any>,
  uri: string,
  claimIsMine: boolean,
  myChannels: ?Array<ChannelClaim>,
  linkedComment?: Comment,
};

function CommentsReplies(props: Props) {
  const { uri, comments, claimIsMine, myChannels, linkedComment } = props;

  const [expanded, setExpanded] = React.useState(false);
  const [start, setStart] = React.useState(0);
  const [end, setEnd] = React.useState(3);
  const sortedComments = comments ? [...comments].reverse() : [];

  const linkedCommentId = linkedComment ? linkedComment.comment_id : '';

  const commentsIndexOfLInked = comments && sortedComments.findIndex(e => e.comment_id === linkedCommentId);
  // const totalComments = comments && comments.length;

  // todo: implement comment_list --mine in SDK so redux can grab with selectCommentIsMine
  const isMyComment = (channelId: string) => {
    if (myChannels != null && channelId != null) {
      for (let i = 0; i < myChannels.length; i++) {
        if (myChannels[i].claim_id === channelId) {
          return true;
        }
      }
    }
    return false;
  };

  React.useEffect(() => {
    if (setStart && setEnd && setExpanded && linkedCommentId && commentsIndexOfLInked > -1) {
      setStart(commentsIndexOfLInked);
      setEnd(commentsIndexOfLInked + 1);
      setExpanded(true);
    }
  }, [setStart, setEnd, setExpanded, linkedCommentId, commentsIndexOfLInked]);

  if (!comments) return null;

  const displayedComments = sortedComments.slice(start, end);

  return (
    <div className={'comment__replies-container'}>
      <div className="comment__actions">
        {!expanded && (
          <Button
            button={'link'}
            label={__('Show %number% Replies', { number: comments.length })}
            onClick={() => setExpanded(true)}
            icon={ICONS.DOWN}
          />
        )}
        {expanded && start > 0 && <Button button={'link'} label={'Show more above'} onClick={() => setStart(0)} />}
        {expanded && <Button button={'link'} label={'Hide Replies'} onClick={() => setExpanded(false)} />}
      </div>
      {comments && displayedComments && expanded && (
        <ul className="comments">
          {displayedComments.map(comment => {
            return (
              <Comment
                uri={uri}
                authorUri={comment.channel_url}
                author={comment.channel_name}
                claimId={comment.claim_id}
                commentId={comment.comment_id}
                key={comment.comment_id}
                message={comment.comment}
                parentId={comment.parent_id || null}
                timePosted={comment.timestamp * 1000}
                claimIsMine={claimIsMine}
                commentIsMine={comment.channel_id && isMyComment(comment.channel_id)}
                linkedComment={linkedComment}
              />
            );
          })}
        </ul>
      )}
      {expanded && comments && end < comments.length && (
        <Button button={'link'} label={'Show more below'} onClick={() => setEnd(end + 10)} />
      )}
    </div>
  );
}

export default CommentsReplies;
