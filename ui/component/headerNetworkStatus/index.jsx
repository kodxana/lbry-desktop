// @flow
import React from 'react';
import classnames from 'classnames';
import Tooltip from 'component/common/tooltip';

const STATUS_LABELS = {
  connected: __('Connected'),
  connecting: __('Connecting'),
  offline: __('Offline'),
  unknown: __('Checking...'),
};

type Props = {
  status: ?string,
  peerCount: ?number,
  compact?: boolean,
};

export default function HeaderNetworkStatus(props: Props) {
  const { status, peerCount, compact = false } = props;

  const normalized = status || 'unknown';
  const state = ['connected', 'connecting', 'offline'].includes(normalized) ? normalized : 'unknown';
  const label = STATUS_LABELS[state] || STATUS_LABELS.unknown;
  const peersAvailable = typeof peerCount === 'number' && peerCount >= 0;

  const tooltip = peersAvailable
    ? __('%status% - %peers% DHT peers', { status: label, peers: peerCount })
    : label;

  return (
    <Tooltip title={tooltip} placement="bottom">
      <div className={classnames('header__network', `header__network--${state}`, { 'header__network--compact': compact })}>
        <span className="header__network-indicator" />
        {!compact && <span className="header__network-label">{label}</span>}
        {peersAvailable && (
          <span className="header__network-count">
            {compact ? peerCount : `- ${__('%count% peers', { count: peerCount })}`}
          </span>
        )}
      </div>
    </Tooltip>
  );
}
