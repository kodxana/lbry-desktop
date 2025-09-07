import { connect } from 'react-redux';
import { doHideModal } from 'redux/actions/app';
import ModalTxDetails from './view';

const select = () => ({});

const perform = (dispatch) => ({
  closeModal: () => dispatch(doHideModal()),
});

export default connect(select, perform)(ModalTxDetails);

