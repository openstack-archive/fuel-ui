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
import {ScreenTransitionWrapper} from 'views/controls';
import DeploymentHistory from 'views/cluster_page_tabs/deployment_history';

var HistoryTab, DeploymentHistoryScreen;

HistoryTab = React.createClass({
  statics: {
    breadcrumbsPath() {
      return [
        [i18n('cluster_page.tabs.history'), null, {active: true}]
      ];
    },
    getSubtabs({cluster}) {
      return _.compact(_.map(cluster.get('deploymentTasks').filterTasks({active: false}), 'id'));
    },
    checkSubroute(tabProps) {
      var {activeTab, cluster, tabOptions} = tabProps;
      var subtabs = this.getSubtabs(tabProps);
      if (activeTab === 'history') {
        var subroute = Number(tabOptions[0]);
        if (!subroute || !_.includes(subtabs, subroute)) {
          app.navigate(
            'cluster/' + cluster.id + '/history' + (subtabs[0] ? '/' + subtabs[0] : ''),
            {trigger: true, replace: true}
          );
        }
        return {activeDeploymentHistoryId: subroute || null};
      }
      return {activeDeploymentHistoryId: subtabs[0] || null};
    }
  },
  getInitialState() {
    return {
      loading: !!this.props.cluster.get('deploymentTasks').findTask({active: false}),
      activeDeploymentHistoryData: null
    };
  },
  loadScreenData(deploymentId) {
    deploymentId = deploymentId || this.props.activeDeploymentHistoryId;
    if (!deploymentId) return;

    return DeploymentHistoryScreen
      .fetchData(deploymentId)
      .then(
        ({history}) => {
          this.setState({loading: false, activeDeploymentHistoryData: history});
        },
        () => {
          app.navigate(
            '#cluster/' + this.props.cluster.id + '/history',
            {trigger: true, replace: true}
          );
        }
      );
  },
  componentDidMount() {
    this.loadScreenData();
  },
  componentWillReceiveProps({cluster, activeDeploymentHistoryId}) {
    var finishedDeployment = cluster.get('deploymentTasks').findTask({active: false});
    if (_.isNull(this.props.activeDeploymentHistoryId) && finishedDeployment) {
      app.navigate(
        'cluster/' + cluster.id + '/history/' + finishedDeployment.id,
        {trigger: true, replace: true}
      );
    }
    if (this.props.activeDeploymentHistoryId !== activeDeploymentHistoryId) {
      this.setState({loading: true, activeDeploymentHistoryData: null});
      this.loadScreenData(activeDeploymentHistoryId);
    }
  },
  render() {
    var {cluster, activeDeploymentHistoryId} = this.props;
    var ns = 'cluster_page.history_tab.';
    var deploymentIds = _.map(cluster.get('deploymentTasks').filterTasks({active: false}), 'id');
    // FIXME(jaranovich): should be 7 in final version
    var visibleDeploymentsAmount = 2;
    var visibleDeployments = deploymentIds;
    var hiddenDeployments = [];
    if (deploymentIds.length > visibleDeploymentsAmount) {
      visibleDeployments = _.takeRight(deploymentIds, visibleDeploymentsAmount - 1);
      hiddenDeployments = _.take(deploymentIds,
        deploymentIds.length - (visibleDeploymentsAmount - 1)
      );
    }

    return (
      <div className='row'>
        <div className='title col-xs-12'>
          {i18n(ns + 'title')}
        </div>
        <div className='wrapper col-xs-12'>
          {deploymentIds.length ?
            <div>
              <div className='deployment-list clearfix'>
                {!!hiddenDeployments.length &&
                  <div>
                    <div className='dropdown'>
                      <button
                        className={utils.classNames({
                          'btn btn-default dropdown-toggle': true,
                          active: _.includes(hiddenDeployments, activeDeploymentHistoryId)
                        })}
                        id='previous-deploymentTasks'
                        data-toggle='dropdown'
                      >
                        <span className='dropdown-name'>
                          {_.includes(hiddenDeployments, activeDeploymentHistoryId) ?
                            ('#' + activeDeploymentHistoryId)
                          :
                            i18n(ns + 'previous_deployments')
                          }
                        </span>
                        <span className='caret' />
                      </button>
                      <ul className='dropdown-menu'>
                        {_.map(
                          _.without(hiddenDeployments, activeDeploymentHistoryId),
                          (deploymentId) => {
                            return (
                              <li key={deploymentId}>
                                <a href={'#cluster/' + cluster.id + '/history/' + deploymentId}>
                                  <span>{'#' + deploymentId}</span>
                                </a>
                              </li>
                            );
                          }
                        )}
                      </ul>
                    </div>
                    <i className='glyphicon glyphicon-arrow-right' />
                  </div>
                }
                {_.map(visibleDeployments, (deploymentId, index) => {
                  return (
                    <div key={deploymentId}>
                      <a
                        className={utils.classNames({
                          'deployment-link': true,
                          active: deploymentId === activeDeploymentHistoryId
                        })}
                        href={'#cluster/' + cluster.id + '/history/' + deploymentId}
                      >
                        <span>{'#' + deploymentId}</span>
                      </a>
                      {index < visibleDeployments.length - 1 &&
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
                    history={this.state.activeDeploymentHistoryData}
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
    fetchData(deploymentId) {
      var history = new models.DeploymentHistory();
      history.url = '/api/transactions/' + deploymentId + '/deployment_history';
      return history.fetch()
        .then(() => ({history}));
    }
  },
  render() {
    return <DeploymentHistory {...this.props} />;
  }
});

export default HistoryTab;
