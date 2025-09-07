// @flow
import * as ICONS from 'constants/icons';
import React, { useEffect, useState, useMemo } from 'react';
import { withRouter } from 'react-router';
import * as TXO from 'constants/txo_list';
import TransactionListTable from 'component/transactionListTable';
import Paginate from 'component/common/paginate';
import { FormField } from 'component/common/form-components/form-field';
import Button from 'component/button';
import Card from 'component/common/card';
import { toCapitalCase } from 'util/string';
import classnames from 'classnames';
import HelpLink from 'component/common/help-link';
import FileExporter from 'component/common/file-exporter';

type Props = {
  search: string,
  history: { action: string, push: (string) => void, replace: (string) => void },
  txoPage: Array<Transaction>,
  txoPageNumber: string,
  txoItemCount: number,
  fetchTxoPage: () => void,
  fetchTransactions: () => void,
  isFetchingTransactions: boolean,
  transactionsFile: string,
  updateTxoPageParams: (any) => void,
  toast: (string, boolean) => void,
};

type Delta = {
  changedParameterKey: string,
  value: string,
};

function TxoList(props: Props) {
  const {
    search,
    txoPage,
    txoItemCount,
    fetchTxoPage,
    fetchTransactions,
    updateTxoPageParams,
    history,
    isFetchingTransactions,
    transactionsFile,
  } = props;

  const urlParams = new URLSearchParams(search);
  const page = urlParams.get(TXO.PAGE) || String(1);
  const pageSize = urlParams.get(TXO.PAGE_SIZE) || String(TXO.PAGE_SIZE_DEFAULT);
  const type = urlParams.get(TXO.TYPE) || TXO.ALL;
  const subtype = urlParams.get(TXO.SUB_TYPE);
  const active = urlParams.get(TXO.ACTIVE) || TXO.ALL;

  const currentUrlParams = {
    page,
    pageSize,
    active,
    type,
    subtype,
  };

  const hideStatus =
    type === TXO.SENT || (currentUrlParams.type === TXO.RECEIVED && currentUrlParams.subtype !== TXO.TIP);

  // this is for sdk params
  const params = {};

  if (currentUrlParams.type) {
    if (currentUrlParams.type === TXO.ALL) {
      params[TXO.EXCLUDE_INTERNAL_TRANSFERS] = true;
      params[TXO.IS_MY_INPUT_OR_OUTPUT] = true;
    } else if (currentUrlParams.type === TXO.SENT) {
      params[TXO.IS_MY_INPUT] = true;
      params[TXO.IS_NOT_MY_OUTPUT] = true;
      if (currentUrlParams.subtype === TXO.TIP) {
        params[TXO.TX_TYPE] = TXO.SUPPORT;
      } else if (currentUrlParams.subtype === TXO.PURCHASE) {
        params[TXO.TX_TYPE] = TXO.PURCHASE;
      } else if (currentUrlParams.subtype === TXO.PAYMENT) {
        params[TXO.TX_TYPE] = TXO.OTHER;
      } else {
        params[TXO.TX_TYPE] = [TXO.OTHER, TXO.PURCHASE, TXO.SUPPORT];
      }
    } else if (currentUrlParams.type === TXO.RECEIVED) {
      params[TXO.IS_MY_OUTPUT] = true;
      params[TXO.IS_NOT_MY_INPUT] = true;
      if (currentUrlParams.subtype === TXO.TIP) {
        params[TXO.TX_TYPE] = TXO.SUPPORT;
      } else if (currentUrlParams.subtype === TXO.PURCHASE) {
        params[TXO.TX_TYPE] = TXO.PURCHASE;
      } else if (currentUrlParams.subtype === TXO.PAYMENT) {
        params[TXO.TX_TYPE] = TXO.OTHER;
        params[TXO.EXCLUDE_INTERNAL_TRANSFERS] = true;
      } else {
        params[TXO.TX_TYPE] = [TXO.OTHER, TXO.PURCHASE, TXO.SUPPORT];
      }
    } else if (currentUrlParams.type === TXO.SUPPORT) {
      params[TXO.TX_TYPE] = TXO.SUPPORT;
      params[TXO.IS_MY_INPUT] = true;
      params[TXO.IS_MY_OUTPUT] = true;
    } else if (currentUrlParams.type === TXO.CHANNEL || currentUrlParams.type === TXO.REPOST) {
      params[TXO.TX_TYPE] = currentUrlParams.type;
    } else if (currentUrlParams.type === TXO.PUBLISH) {
      params[TXO.TX_TYPE] = TXO.STREAM;
    } else if (currentUrlParams.type === TXO.COLLECTION) {
      params[TXO.TX_TYPE] = currentUrlParams.type;
    }
  }
  if (currentUrlParams.active) {
    if (currentUrlParams.active === 'spent') {
      params[TXO.IS_SPENT] = true;
    } else if (currentUrlParams.active === 'active') {
      params[TXO.IS_NOT_SPENT] = true;
    }
  }

  if (currentUrlParams.page) params[TXO.PAGE] = Number(page);
  if (currentUrlParams.pageSize) params[TXO.PAGE_SIZE] = Number(pageSize);

  function handleChange(delta: Delta) {
    const url = updateUrl(delta);
    history.push(url);
  }

  function updateUrl(delta: Delta) {
    const newUrlParams = new URLSearchParams();

    switch (delta.changedParameterKey) {
      case TXO.PAGE:
        if (currentUrlParams.type) {
          newUrlParams.set(TXO.TYPE, currentUrlParams.type);
        }
        if (currentUrlParams.subtype) {
          newUrlParams.set(TXO.SUB_TYPE, currentUrlParams.subtype);
        }
        if (currentUrlParams.active) {
          newUrlParams.set(TXO.ACTIVE, currentUrlParams.active);
        }
        newUrlParams.set(TXO.PAGE, delta.value);
        break;
      case TXO.TYPE:
        newUrlParams.set(TXO.TYPE, delta.value);
        if (delta.value === TXO.SENT || delta.value === TXO.RECEIVED) {
          newUrlParams.set(TXO.ACTIVE, 'all');
          if (currentUrlParams.subtype) {
            newUrlParams.set(TXO.SUB_TYPE, currentUrlParams.subtype);
          } else {
            newUrlParams.set(TXO.SUB_TYPE, 'all');
          }
        }
        if (currentUrlParams.active && !hideStatus) {
          newUrlParams.set(TXO.ACTIVE, currentUrlParams.active);
        } else {
          newUrlParams.set(TXO.ACTIVE, 'all');
        }
        newUrlParams.set(TXO.PAGE, String(1));
        newUrlParams.set(TXO.PAGE_SIZE, currentUrlParams.pageSize);
        break;
      case TXO.SUB_TYPE:
        if (currentUrlParams.type) {
          newUrlParams.set(TXO.TYPE, currentUrlParams.type);
        }
        newUrlParams.set(TXO.ACTIVE, 'all');
        newUrlParams.set(TXO.SUB_TYPE, delta.value);
        newUrlParams.set(TXO.PAGE, String(1));
        newUrlParams.set(TXO.PAGE_SIZE, currentUrlParams.pageSize);
        break;
      case TXO.ACTIVE:
        if (currentUrlParams.type) {
          newUrlParams.set(TXO.TYPE, currentUrlParams.type);
        }
        if (currentUrlParams.subtype) {
          newUrlParams.set(TXO.SUB_TYPE, currentUrlParams.subtype);
        }
        newUrlParams.set(TXO.ACTIVE, delta.value);
        newUrlParams.set(TXO.PAGE, String(1));
        newUrlParams.set(TXO.PAGE_SIZE, currentUrlParams.pageSize);
        break;
    }

    return `?${newUrlParams.toString()}`;
  }

  const paramsString = JSON.stringify(params);

  useEffect(() => {
    if (paramsString && updateTxoPageParams) {
      const params = JSON.parse(paramsString);
      updateTxoPageParams(params);
    }
  }, [paramsString, updateTxoPageParams]);

  // Local client-side filters (query + amount range) applied to current page
  const [query, setQuery] = useState('');
  const [minAmt, setMinAmt] = useState('');
  const [maxAmt, setMaxAmt] = useState('');

  const filteredTxos = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = minAmt ? Number(minAmt) : null;
    const max = maxAmt ? Number(maxAmt) : null;
    return (txoPage || []).filter((t) => {
      try {
        if (min !== null && Number(t.amount) < min) return false;
        if (max !== null && Number(t.amount) > max) return false;
      } catch (e) {}
      if (!q) return true;
      const hay = [t.txid, t.normalized_name, t.type, t.value_type, t.signing_channel && t.signing_channel.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [txoPage, query, minAmt, maxAmt]);

  return (
    <Card
      title={
        <>
          <div className="table__header-text txo__table_header">{__(`Transactions`)}</div>
        </>
      }
      isBodyList
      body={
        <div>
          {/* LBC transactions section */}
          <div className="card__body-actions">
            <div className="card__actions card__actions--between">
              <div className="txo__filters">
                <div>
                  {/* LBC transaction type dropdown */}
                  <FormField
                    type="select"
                    name="type"
                    label={
                      <>
                        {__('Type')}
                        <HelpLink href="https://lbry.com/faq/transaction-types" />
                      </>
                    }
                    value={type || 'all'}
                    onChange={(e) => handleChange({ changedParameterKey: TXO.TYPE, value: e.target.value })}
                  >
                    {Object.values(TXO.DROPDOWN_TYPES).map((v) => {
                      const stringV = String(v);
                      return (
                        <option key={stringV} value={stringV}>
                          {stringV && __(toCapitalCase(stringV))}
                        </option>
                      );
                    })}
                  </FormField>
                </div>
                {(type === TXO.SENT || type === TXO.RECEIVED) && (
                  <FormField
                    type="select"
                    name="subtype"
                    label={__('Payment Type')}
                    value={subtype || 'all'}
                    onChange={(e) => handleChange({ changedParameterKey: TXO.SUB_TYPE, value: e.target.value })}
                  >
                    {Object.values(TXO.DROPDOWN_SUBTYPES).map((v) => {
                      const stringV = String(v);
                      return (
                        <option key={stringV} value={stringV}>
                          {stringV && __(toCapitalCase(stringV))}
                        </option>
                      );
                    })}
                  </FormField>
                )}
                {!hideStatus && (
                  <FormField
                    type="select"
                    name="status"
                    label={__('Status')}
                    value={active || 'all'}
                    onChange={(e) => handleChange({ changedParameterKey: TXO.ACTIVE, value: e.target.value })}
                  >
                    <option value="active">{__('Active')}</option>
                    <option value="spent">{__('Historical')}</option>
                    <option value="all">{__('All')}</option>
                  </FormField>
                )}
                <FormField
                  type="text"
                  name="tx-search"
                  label={__('Search (txid, address, claim)')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <FormField
                  type="text"
                  name="min-amt"
                  label={__('Min Amount')}
                  value={minAmt}
                  onChange={(e) => setMinAmt(e.target.value)}
                />
                <FormField
                  type="text"
                  name="max-amt"
                  label={__('Max Amount')}
                  value={maxAmt}
                  onChange={(e) => setMaxAmt(e.target.value)}
                />
              </div>
              {/* export and refresh buttons */}
              <div className="card__actions--inline">
                {!isFetchingTransactions && transactionsFile === null && (
                  <label>{<span className="error__text">{__('Failed to process fetched data.')}</span>}</label>
                )}
                <div className="txo__export">
                  <FileExporter
                    data={transactionsFile}
                    label={__('Export All')}
                    tooltip={__('Fetch transaction data for export')}
                    defaultFileName={'transactions-history.csv'}
                    onFetch={() => fetchTransactions()}
                    progressMsg={isFetchingTransactions ? __('Fetching data') : ''}
                  />
                </div>
                <Button button="alt" icon={ICONS.REFRESH} label={__('Refresh')} onClick={() => fetchTxoPage()} />
              </div>
            </div>
          </div>
          {/* listing of the lbc transactions */}
          <TransactionListTable txos={filteredTxos} />
          <Paginate totalPages={Math.ceil(txoItemCount / Number(pageSize))} />
        </div>
      }
    />
  );
}

export default withRouter(TxoList);

