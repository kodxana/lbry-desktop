// @flow

import React, { useState, useEffect, useRef } from 'react';
import { FormField } from 'component/common/form';
import Button from 'component/button';
import * as ICONS from 'constants/icons';
import ServerInputRow from './internal/inputRow';
import { stringifyServerParam } from 'util/sync-settings';

type StatusOfServer = {
  host: string,
  port: string,
  availability: boolean,
  latency: number,
};

type ServerTuple = [string, string]; // ['host', 'port']
type ServerStatus = Array<StatusOfServer>;
type ServerConfig = Array<ServerTuple>;
type DaemonStatus = {
  wallet: any,
};

type Props = {
  getDaemonStatus: () => void,
  setCustomWalletServers: (any) => void,
  clearWalletServers: () => void,
  setDefaultWalletServer: () => void,
  customWalletServers: ServerConfig,
  saveServerConfig: (Array<ServerTuple>) => void,
  hasWalletServerPrefs: boolean,
  daemonStatus: DaemonStatus,
  walletReconnecting: boolean,
  walletRollbackToDefault: boolean,
  walletReconnectingToDefault: boolean,
};

function SettingWalletServer(props: Props) {
  const {
    daemonStatus,
    setCustomWalletServers,
    getDaemonStatus,
    clearWalletServers,
    setDefaultWalletServer,
    saveServerConfig,
    customWalletServers,
    hasWalletServerPrefs,
    walletReconnecting,
    walletRollbackToDefault,
    walletReconnectingToDefault,
  } = props;

  const [usingCustomServer, setUsingCustomServer] = useState(false);
  const [showCustomServers, setShowCustomServers] = useState(false);

  const walletStatus = daemonStatus && daemonStatus.wallet;
  const activeWalletServers: ServerStatus = (walletStatus && walletStatus.servers) || [];
  const availableServers = walletStatus && walletStatus.available_servers;
  const serverConfig: ServerConfig = customWalletServers;
  const STATUS_INTERVAL = 5000;

  // onUnmount, if there are no available servers, doClear()
  // in order to replicate componentWillUnmount, the effect needs to get the value from a ref
  const hasAvailableRef = useRef();
  useEffect(
    () => () => {
      hasAvailableRef.current = availableServers;
    },
    [availableServers]
  );

  useEffect(
    () => () => {
      if (!hasAvailableRef.current) {
        doClear();
      }
    },
    []
  );

  useEffect(() => {
    if (hasWalletServerPrefs) {
      setUsingCustomServer(true);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      getDaemonStatus();
    }, STATUS_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (walletRollbackToDefault) {
      doClear();
    }
  }, [walletRollbackToDefault]);

  useEffect(() => {
    if (usingCustomServer) {
      setShowCustomServers(true);
    }
  }, [usingCustomServer]);

  function doClear() {
    setUsingCustomServer(false);
    clearWalletServers();
  }

  function onAdd(serverTuple: ServerTuple) {
    let newServerConfig = serverConfig.concat();
    newServerConfig.push(serverTuple);
    updateServers(newServerConfig);
  }

  function onDelete(i: number) {
    const newServerConfig = serverConfig.concat();
    newServerConfig.splice(i, 1);
    updateServers(newServerConfig);
  }

  function updateServers(newConfig) {
    saveServerConfig(newConfig);
    setCustomWalletServers(stringifyServerParam(newConfig));
  }

  return (
    <React.Fragment>
      <fieldset-section>
        <FormField
          type="radio"
          name="default_wallet_servers"
          checked={!usingCustomServer}
          label={__('Use lbry.network wallet server (s1.lbry.network:50001)')}
          onChange={(e) => {
            if (e.target.checked) {
              setUsingCustomServer(false);
              setDefaultWalletServer();
            }
          }}
        />
        <FormField
          type="radio"
          name="custom_wallet_servers"
          checked={usingCustomServer}
          onChange={(e) => {
            setUsingCustomServer(e.target.checked);
            if (e.target.checked && customWalletServers.length) {
              setCustomWalletServers(stringifyServerParam(customWalletServers));
            }
          }}
          label={__('Use custom wallet servers')}
        />

        {/* Status panel */}
        <div className="section section--padded card--inline form-field__internal-option wallet-status">
          <div className="wallet-status__header">
            <h3 className="wallet-status__title">{__('Wallet Server Status')}</h3>
            <div className="wallet-status__legend">
              <span className="status-dot status-dot--online" /> {__('Online')}
              <span className="status-dot status-dot--offline" /> {__('Offline')}
            </div>
          </div>
          <div className="help">
            {__(
              'Wallet servers relay blockchain data and determine content availability. This app monitors reachability and round‑trip time.'
            )}
          </div>

          {activeWalletServers && activeWalletServers.length > 0 ? (
            <table className="table table--condensed wallet-status__table">
              <thead>
                <tr>
                  <th>{__('Host')}</th>
                  <th className="wallet-status__col--port">{__('Port')}</th>
                  <th className="wallet-status__col--status">{__('Status')}</th>
                  <th className="wallet-status__col--latency">{__('Latency')}</th>
                </tr>
              </thead>
              <tbody>
                {activeWalletServers.map((s) => {
                  const isUp = !!s.availability;
                  let latencyText = __('Unknown');
                  if (typeof s.latency === 'number') {
                    const ms = s.latency > 0 && s.latency < 1 ? Math.round(s.latency * 1000) : Math.round(s.latency);
                    latencyText = ms <= 0 ? '<1 ms' : `${ms} ms`;
                  }
                  return (
                    <tr key={`${s.host}:${s.port}`}>
                      <td>{s.host}</td>
                      <td className="wallet-status__col--port">{s.port}</td>
                      <td className="wallet-status__col--status">
                        <span className={`status-dot ${isUp ? 'status-dot--online' : 'status-dot--offline'}`} />
                        <span className="wallet-status__label">{isUp ? __('Online') : __('Offline')}</span>
                      </td>
                      <td className="wallet-status__col--latency">{latencyText}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="help">{__('No status yet. Try Refresh.')}</div>
          )}

          <div className="card__actions wallet-status__actions">
            <Button button="secondary" label={__('Refresh')} onClick={() => getDaemonStatus()} />
          </div>
        </div>

        {showCustomServers && (
          <div>
            {serverConfig &&
              serverConfig.map((entry, index) => {
                const [host, port] = entry;
                const available = activeWalletServers.some(
                  (s) => s.host === entry[0] && String(s.port) === entry[1] && s.availability
                );

                return (
                  <div
                    key={`${host}:${port}`}
                    className="section section--padded card--inline form-field__internal-option"
                  >
                    <h3>
                      {host}:{port}
                    </h3>
                    <span className="help">
                      {available
                        ? __('Connected')
                        : walletReconnecting && !walletReconnectingToDefault
                        ? __('Connecting...')
                        : __('Not connected')}
                    </span>
                    <Button
                      button="close"
                      title={__('Remove custom wallet server')}
                      icon={ICONS.REMOVE}
                      onClick={() => onDelete(index)}
                    />
                  </div>
                );
              })}
            <div className="form-field__internal-option">
              <ServerInputRow update={onAdd} />
            </div>
          </div>
        )}
      </fieldset-section>
    </React.Fragment>
  );
}

export default SettingWalletServer;
