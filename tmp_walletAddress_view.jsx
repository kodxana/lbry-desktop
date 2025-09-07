// @flow
import React from 'react';
import { FormField } from 'component/common/form-components/form-field';
import Button from 'component/button';
import CopyableText from 'component/copyableText';
import QRCode from 'component/common/qr-code';
import Card from 'component/common/card';

type Props = {
  checkAddressIsMine: (string) => void,
  receiveAddress: string,
  getNewAddress: () => void,
  gettingNewAddress: boolean,
  addressList: Array<any>,
  addressListLoading: boolean,
  fetchAddressList: () => void,
  setReceiveAddress: (string) => void,
};

type State = {
  showQR: boolean,
};

class WalletAddress extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      showQR: false,
    };

    (this: any).toggleQR = this.toggleQR.bind(this);
  }

  componentDidMount() {
    const { checkAddressIsMine, receiveAddress, getNewAddress, fetchAddressList } = this.props;
    try { fetchAddressList(); } catch (e) {}
    if (!receiveAddress) {
      getNewAddress();
    } else {
      checkAddressIsMine(receiveAddress);
    }

  toggleQR() {
    this.setState({
      showQR: !this.state.showQR,
    });
  }

  componentDidUpdate(prevProps: Props) {
    const { receiveAddress, addressList, setReceiveAddress, checkAddressIsMine } = this.props;
    if (!receiveAddress && addressList && addressList.length) {
      const first = addressList[0] && (addressList[0].address || addressList[0]);
      if (first) {
        try {
          setReceiveAddress(first);
          checkAddressIsMine(first);
        } catch (e) {}
      }
    }
  }
  render() {
    const { receiveAddress, getNewAddress, gettingNewAddress, addressList, addressListLoading, setReceiveAddress } = this.props;
    const { showQR } = this.state;

    return (
      <Card
        title={__('Receive Credits')}
        subtitle={__('Use this address to receive LBRY Credits.')}
        actions={
          <React.Fragment>
            <CopyableText
              primaryButton
              label={__('Your Address')}
              copyable={receiveAddress}
              snackMessage={__('Address copied.')}
            />

            <div className="card__actions">
              <Button
                button="secondary"
                label={__('Get New Address')}
                onClick={getNewAddress}
                disabled={gettingNewAddress}
              />
              <Button button="link" label={showQR ? __('Hide QR code') : __('Show QR code')} onClick={this.toggleQR} />
            </div>
            <p className="help">
              {__('You can generate a new address at any time, and any previous addresses will continue to work.')}
            

            <FormField
              type=\"select\"
            </p>
              label={__('Select main receive address')}
              disabled={addressListLoading}
              value={receiveAddress || ''}
              onChange={(e) => setReceiveAddress(e.target.value)}
            >
              {(addressList || []).map((item) => {
                const addr = item && (item.address || item);
                return (
                  <option key={addr} value={addr}>
                    {addr}
                  </option>
                );
              })}
            </FormField>
            
          </React.Fragment>
        }
      />
    );
  }
}

export default WalletAddress;







