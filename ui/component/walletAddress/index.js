import { connect } from 'react-redux';
import {
  selectReceiveAddress,
  selectGettingNewAddress,
  selectAddressList,
  selectAddressListLoading,
} from 'redux/selectors/wallet';
import {
  doCheckAddressIsMine,
  doGetNewAddress,
  doFetchAddressList,
  doSetReceiveAddress,
} from 'redux/actions/wallet';
import WalletAddress from './view';
import { withRouter } from 'react-router';

const select = (state) => ({
  receiveAddress: selectReceiveAddress(state),
  gettingNewAddress: selectGettingNewAddress(state),
  addressList: selectAddressList(state),
  addressListLoading: selectAddressListLoading(state),
});

const perform = (dispatch) => ({
  checkAddressIsMine: (address) => dispatch(doCheckAddressIsMine(address)),
  getNewAddress: () => dispatch(doGetNewAddress()),
  fetchAddressList: () => dispatch(doFetchAddressList()),
  setReceiveAddress: (address) => dispatch(doSetReceiveAddress(address)),
});

export default withRouter(connect(select, perform)(WalletAddress));
