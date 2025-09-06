import * as MODALS from 'constants/modal_types';
import { connect } from 'react-redux';
import { selectDaemonVersionMatched, selectModal, selectSplashAnimationEnabled } from 'redux/selectors/app';
import { doCheckDaemonVersion, doOpenModal, doHideModal, doToggleSplashAnimation } from 'redux/actions/app';
import { doClearDaemonSetting, doSetDaemonSetting } from 'redux/actions/settings';
import { stringifyServerParam } from 'util/sync-settings';
import * as DAEMON_SETTINGS from 'constants/daemon_settings';
import { doToast } from 'redux/actions/notifications';
import SplashScreen from './view';

const select = (state) => ({
  modal: selectModal(state),
  daemonVersionMatched: selectDaemonVersionMatched(state),
  animationHidden: selectSplashAnimationEnabled(state),
});

const perform = (dispatch) => ({
  checkDaemonVersion: () => dispatch(doCheckDaemonVersion()),
  notifyUnlockWallet: (shouldTryWithBlankPassword) =>
    dispatch(doOpenModal(MODALS.WALLET_UNLOCK, { shouldTryWithBlankPassword })),
  hideModal: () => dispatch(doHideModal()),
  toggleSplashAnimation: () => dispatch(doToggleSplashAnimation()),
  clearWalletServers: () => dispatch(doClearDaemonSetting(DAEMON_SETTINGS.LBRYUM_SERVERS)),
  setWalletServers: () => {
    const servers = [
      ['s1.lbry.network', '50001'],
    ];
    dispatch(doSetDaemonSetting(DAEMON_SETTINGS.LBRYUM_SERVERS, stringifyServerParam(servers)));
  },
  doShowSnackBar: (message) => dispatch(doToast({ isError: true, message })),
});

export default connect(select, perform)(SplashScreen);
