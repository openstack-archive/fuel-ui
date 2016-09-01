/*
 * Copyright 2016 Mirantis, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 **/
import _ from 'underscore';
import i18n from 'i18n';
import React from 'react';
import ReactTransitionGroup from 'react-addons-transition-group';
import models from 'models';
import utils from 'utils';
import {Link, ScreenTransitionWrapper} from 'views/controls';
import DeploymentHistory from 'views/cluster_page_tabs/deployment_history_component';

var HistoryTab, DeploymentHistoryScreen;

HistoryTab = React.createClass({
  statics: {
    breadcrumbsPath() {
      return [
        [i18n('cluster_page.tabs.history'), null, {active: true}]
      ];
    },
    getSubtabs({cluster}) {
      return _.map(cluster.get('transactions').filterTasks({active: false}), 'id');
    },
    checkSubroute(tabProps) {
      var {activeTab, cluster, tabOptions} = tabProps;
      var subtabs = this.getSubtabs(tabProps);
      var defaultSubtab = _.last(subtabs);
      if (activeTab === 'history') {
        var transactionId = Number(tabOptions[0]);
        if (!transactionId || !_.includes(subtabs, transactionId)) {
          app.navigate(
            '/cluster/' + cluster.id + '/history' + (defaultSubtab ? '/' + defaultSubtab : ''),
            {replace: true}
          );
        }
        return {activeTransactionId: transactionId || null};
      }
      return {activeTransactionId: defaultSubtab || null};
    }
  },
  getInitialState() {
    return {
      loading: !!this.props.cluster.get('transactions').findTask({active: false}),
      deploymentHistory: null
    };
  },
  loadScreenData(transactionId) {
    transactionId = transactionId || this.props.activeTransactionId;
    if (_.isNull(transactionId)) return;

    return DeploymentHistoryScreen
      .fetchData(transactionId)
      .then(
        ({deploymentHistory}) => {
          this.setState({loading: false, deploymentHistory});
        },
        () => {
          app.navigate(
            '/cluster/' + this.props.cluster.id + '/history',
            {replace: true}
          );
        }
      );
  },
  componentDidMount() {
    this.loadScreenData();
  },
  componentWillReceiveProps({cluster, activeTransactionId}) {
    var transaction = _.last(cluster.get('transactions').filterTasks({active: false}));
    if (_.isNull(this.props.activeTransactionId) && transaction) {
      app.navigate(
        '/cluster/' + cluster.id + '/history/' + transaction.id,
        {replace: true}
      );
    }
    if (this.props.activeTransactionId !== activeTransactionId) {
      this.setState({loading: true, deploymentHistory: null});
      this.loadScreenData(activeTransactionId);
    }
  },
  renderTransactionTitle(transaction) {
    return [
      <span key='graph'>
        {i18n(
          'cluster_page.history_tab.graph_titles.' + transaction.get('graph_type'),
          {defaultValue: transaction.get('graph_type')}
        )}
      </span>,
      <span key='id'>{'#' + transaction.id}</span>
    ];
  },
  render() {
    var {cluster, activeTransactionId} = this.props;
    var {deploymentHistory} = this.state;
    var ns = 'cluster_page.history_tab.';
    var transactions = cluster.get('transactions').filterTasks({active: false});
    var visibleTransactionsAmount = 2;
    var visibleTransactions = transactions;
    var hiddenTransactions = [];
    var activeHiddenTransaction;
    if (transactions.length > visibleTransactionsAmount) {
      visibleTransactions = _.takeRight(transactions, visibleTransactionsAmount - 1);
      hiddenTransactions = _.take(transactions,
        transactions.length - (visibleTransactionsAmount - 1)
      ).reverse();
      activeHiddenTransaction = _.find(hiddenTransactions, {id: activeTransactionId});
    }

    return (
      <div className='row'>
        <div className='title col-xs-12'>
          {i18n(ns + 'title')}
        </div>
        <div className='wrapper col-xs-12'>
          {transactions.length ?
            <div>
              <div className='transaction-list clearfix'>
                {!!hiddenTransactions.length &&
                  <div>
                    <div className='dropdown'>
                      <button
                        className={utils.classNames({
                          'btn btn-default dropdown-toggle': true,
                          [activeHiddenTransaction && activeHiddenTransaction.get('status')]:
                            activeHiddenTransaction,
                          active: activeHiddenTransaction
                        })}
                        id='previous-transactions'
                        data-toggle='dropdown'
                      >
                        {activeHiddenTransaction ?
                          this.renderTransactionTitle(activeHiddenTransaction)
                        :
                          <span className='previous-deployments'>
                            {i18n(ns + 'previous_deployments')}
                          </span>
                        }
                        <span className='caret' />
                      </button>
                      <ul className='dropdown-menu'>
                        {_.map(
                          _.reject(hiddenTransactions, {id: activeTransactionId}),
                          (transaction) => {
                            return (
                              <li key={transaction.id}>
                                <Link
                                  to={'/cluster/' + cluster.id + '/history/' + transaction.id}
                                  className={transaction.get('status')}
                                >
                                  {this.renderTransactionTitle(transaction)}
                                </Link>
                              </li>
                            );
                          }
                        )}
                      </ul>
                    </div>
                    <i className='glyphicon glyphicon-arrow-right' />
                  </div>
                }
                {_.map(visibleTransactions, (transaction, index) => {
                  return (
                    <div key={transaction.id}>
                      <Link
                        to={'/cluster/' + cluster.id + '/history/' + transaction.id}
                        className={utils.classNames({
                          'transaction-link': true,
                          [transaction.get('status')]: true,
                          active: transaction.id === activeTransactionId
                        })}
                      >
                        {this.renderTransactionTitle(transaction)}
                      </Link>
                      {index < visibleTransactions.length - 1 &&
                        <i className='glyphicon glyphicon-arrow-right' />
                      }
                    </div>
                  );
                })}
              </div>
              {!_.isNull(deploymentHistory) &&
                <ReactTransitionGroup
                  component='div'
                  transitionName='screen'
                >
                  <ScreenTransitionWrapper key={screen} loading={this.state.loading}>
                    <DeploymentHistoryScreen
                      ref='screen'
                      deploymentHistory={deploymentHistory}
                      transaction={cluster.get('transactions').get(activeTransactionId)}
                      cluster={cluster}
                      nodes={cluster.get('nodes')}
                      nodeNetworkGroups={cluster.get('nodeNetworkGroups')}
                    />
                  </ScreenTransitionWrapper>
                </ReactTransitionGroup>
              }
            </div>
          :
            <div className='alert alert-warning'>
              {i18n(ns + 'no_finished_deployment_alert')}
            </div>
          }
        </div>
      </div>
    );
  }
});

DeploymentHistoryScreen = React.createClass({
  statics: {
    fetchData(transactionId) {
      var deploymentHistory = new models.DeploymentTasks();
      deploymentHistory.url = '/api/transactions/' + transactionId + '/deployment_history';
      return deploymentHistory.fetch()
        .then(() => ({deploymentHistory}));
    }
  },
  render() {
    return <DeploymentHistory {...this.props} width={1128} />;
  }
});

export default HistoryTab;
