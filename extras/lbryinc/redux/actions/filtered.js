import { Lbryio } from 'lbryinc';
import * as ACTIONS from 'constants/action_types';

const CHECK_FILTERED_CONTENT_INTERVAL = 60 * 60 * 1000;

export function doFetchFilteredOutpoints() {
  // Disabled external filtering API; return empty set to avoid network calls.
  return (dispatch) => {
    dispatch({ type: ACTIONS.FETCH_FILTERED_CONTENT_STARTED });
    dispatch({
      type: ACTIONS.FETCH_FILTERED_CONTENT_COMPLETED,
      data: { outpoints: [] },
    });
  };
}

export function doFilteredOutpointsSubscribe() {
  // Keep interface, but do not schedule network activity.
  return (dispatch) => {
    dispatch(doFetchFilteredOutpoints());
  };
}
