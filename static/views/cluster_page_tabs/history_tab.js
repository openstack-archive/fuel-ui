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
            {trigger: true, replace: true}
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
    if (_.isNull(transactionId)) return null;

    return DeploymentHistoryScreen
      .fetchData(transactionId)
      .then(
        ({deploymentHistory}) => {
          this.setState({loading: false, deploymentHistory});
        },
        () => {
          app.navigate(
            '/cluster/' + this.props.cluster.id + '/history',
            {trigger: true, replace: true}
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
        {trigger: true, replace: true}
      );
    }
    if (this.props.activeTransactionId !== activeTransactionId) {
      this.setState({loading: true, deploymentHistory: null});
      this.loadScreenData(activeTransactionId);
    }
  },
  render() {
    var {cluster, activeTransactionId} = this.props;
    var ns = 'cluster_page.history_tab.';
    var transactionIds = _.map(cluster.get('transactions').filterTasks({active: false}), 'id');
    var visibleTransactionsAmount = 7;
    var visibleTransactions = transactionIds;
    var hiddenTransactions = [];
    if (transactionIds.length > visibleTransactionsAmount) {
      visibleTransactions = _.takeRight(transactionIds, visibleTransactionsAmount - 1);
      hiddenTransactions = _.take(transactionIds,
        transactionIds.length - (visibleTransactionsAmount - 1)
      ).reverse();
    }

    return (
      <div className='row'>
        <div className='title col-xs-12'>
          {i18n(ns + 'title')}
        </div>
        <div className='wrapper col-xs-12'>
          {transactionIds.length ?
            <div>
              <div className='transaction-list clearfix'>
                {!!hiddenTransactions.length &&
                  <div>
                    <div className='dropdown'>
                      <button
                        className={utils.classNames({
                          'btn btn-default dropdown-toggle': true,
                          active: _.includes(hiddenTransactions, activeTransactionId)
                        })}
                        id='previous-transactions'
                        data-toggle='dropdown'
                      >
                        <span className='dropdown-name'>
                          {_.includes(hiddenTransactions, activeTransactionId) ?
                            ('#' + activeTransactionId)
                          :
                            i18n(ns + 'previous_deployments')
                          }
                        </span>
                        <span className='caret' />
                      </button>
                      <ul className='dropdown-menu'>
                        {_.map(
                          _.without(hiddenTransactions, activeTransactionId),
                          (transactionId) => {
                            return (
                              <li key={transactionId}>
                                <Link to={'/cluster/' + cluster.id + '/history/' + transactionId}>
                                  <span>{'#' + transactionId}</span>
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
                {_.map(visibleTransactions, (transactionId, index) => {
                  return (
                    <div key={transactionId}>
                      <Link
                        to={'/cluster/' + cluster.id + '/history/' + transactionId}
                        className={utils.classNames({
                          'transaction-link': true,
                          active: transactionId === activeTransactionId
                        })}
                      >
                        <span>{'#' + transactionId}</span>
                      </Link>
                      {index < visibleTransactions.length - 1 &&
                        <i className='glyphicon glyphicon-arrow-right' />
                      }
                    </div>
                  );
                })}
              </div>
              <ReactTransitionGroup
                component='div'
                transitionName='screen'
              >
                <ScreenTransitionWrapper key={screen} loading={this.state.loading}>
                  <DeploymentHistoryScreen
                    {...this.props}
                    ref='screen'
                    deploymentHistory={this.state.deploymentHistory}
                  />
                </ScreenTransitionWrapper>
              </ReactTransitionGroup>
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
    return <DeploymentHistory {...this.props} />;
  }
});

export default HistoryTab;
