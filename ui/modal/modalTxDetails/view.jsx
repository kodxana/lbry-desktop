// @flow
import React from 'react';
import Button from 'component/button';
import Card from 'component/common/card';

type Props = {
  txo: any,
  closeModal: () => void,
};

export default function ModalTxDetails(props: Props) {
  const { txo, closeModal } = props;

  const pretty = () => {
    try {
      return JSON.stringify(txo || {}, null, 2);
    } catch (e) {
      return String(txo);
    }
  };

  const rows = [
    ['Type', txo && (txo.type || '')],
    ['Amount', txo && (txo.amount != null ? String(txo.amount) : '')],
    ['Date', txo && txo.timestamp ? new Date(txo.timestamp * 1000).toString() : 'Pending'],
    ['TxID', txo && txo.txid],
    ['Claim', txo && (txo.normalized_name || '')],
  ];

  return (
    <Card
      title={__('Transaction Details')}
      actions={
        <div>
          <div className="section__subtitle">
            {rows.map(([k, v]) => (
              <div key={k} style={{ marginBottom: 'var(--spacing-xxs)' }}>
                <strong>{k}: </strong>
                <span style={{ wordBreak: 'break-all' }}>{v}</span>
              </div>
            ))}
          </div>
          <div className="section__subtitle" style={{ marginTop: 'var(--spacing-m)' }}>
            <div style={{ marginBottom: 'var(--spacing-xxs)' }}>{__('Raw')}</div>
            <pre className="code code--small" style={{ maxHeight: '40vh', overflow: 'auto' }}>
              {pretty()}
            </pre>
          </div>
          <div className="card__actions">
            <Button button="primary" label={__('Close')} onClick={closeModal} />
          </div>
        </div>
      }
    />
  );
}

