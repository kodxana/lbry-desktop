import { Lbryio } from 'lbryinc';
import * as ACTIONS from 'constants/action_types';

const CHECK_BLACK_LISTED_CONTENT_INTERVAL = 60 * 60 * 1000;

export function doFetchBlackListedOutpoints() {
  // Disabled external blacklist API; return empty set to avoid network calls.
  return (dispatch) => {
    dispatch({ type: ACTIONS.FETCH_BLACK_LISTED_CONTENT_STARTED });
    dispatch({
      type: ACTIONS.FETCH_BLACK_LISTED_CONTENT_COMPLETED,
      data: { outpoints: [], success: true },
    });
  };
}

export function doBlackListedOutpointsSubscribe() {
  // Keep interface, but do not schedule network activity.
  return (dispatch) => {
    dispatch(doFetchBlackListedOutpoints());
  };
}
