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
import utils from 'utils';
import models from 'models';
import {ScreenTransitionWrapper, Input} from 'views/controls';
import {backboneMixin, pollingMixin} from 'component_mixins';
import DeploymentHistory from 'views/cluster_page_tabs/deployment_history';

var DeploymentHistoryTab, DeploymentHistoryScreen;

DeploymentHistoryTab = React.createClass({
  mixins: [
    backboneMixin({
      modelOrCollection: (props) => props.cluster.get('deployments')
    }),
    pollingMixin(60, true)
  ],
  statics: {
    breadcrumbsPath() {
      return [
        [i18n('cluster_page.tabs.deployment_history'), null, {active: true}]
      ];
    },
    isVisible(cluster) {
      return cluster.get('deployments').some((deployment) => !deployment.isActive());
    },
    fetchData({cluster}) {
      return cluster.get('deployments').fetch({cache: true}).then(() => ({}));
    },
    getSubtabs({cluster}) {
      return _.compact(_.map(
        cluster.get('deployments').filter((deployment) => !deployment.isActive()),
        'id'
      ));
    },
    checkSubroute(tabProps) {
      var {activeTab, cluster, tabOptions} = tabProps;
      var subtabs = this.getSubtabs(tabProps);
      if (activeTab === 'deployment_history') {
        var subroute = Number(tabOptions[0]);
        if (!subroute || !_.includes(subtabs, subroute)) {
          app.navigate(
            'cluster/' + cluster.id + '/deployment_history/' + subtabs[0],
            {trigger: true, replace: true}
          );
        }
        return {activeDeploymentHistoryId: subroute};
      }
      return {activeDeploymentHistoryId: subtabs[0]};
    }
  },
  getInitialState() {
    return {
      loading: true,
      activeDeploymentHistoryData: null
    };
  },
  shouldDataBeFetched() {
    // fetch deployment list to render just finished deployment
    return this.props.cluster.get('deployments').some((deployment) => deployment.isActive());
  },
  fetchData() {
    this.props.cluster.get('deployments').fetch();
  },
  loadScreenData(deploymentId) {
    return DeploymentHistoryScreen
      .fetchData(deploymentId || this.props.activeDeploymentHistoryId)
      .then(
        ({history}) => {
          this.setState({loading: false, activeDeploymentHistoryData: history});
        },
        () => {
          app.navigate(
            '#cluster/' + this.props.cluster.id + '/deployment_history',
            {trigger: true, replace: true}
          );
        }
      );
  },
  componentDidMount() {
    this.loadScreenData();
  },
  componentWillReceiveProps({activeDeploymentHistoryId}) {
    if (this.props.activeDeploymentHistoryId !== activeDeploymentHistoryId) {
      this.setState({activeDeploymentHistoryData: null, loading: true});
      this.loadScreenData(activeDeploymentHistoryId);
    }
  },
  showDeploymentHistory(deploymentsControlName, deploymentId) {
    app.navigate(
      'cluster/' + this.props.cluster.id + '/deployment_history/' + deploymentId,
      {trigger: true, replace: true}
    );
  },
  render() {
    var {cluster, activeDeploymentHistoryId} = this.props;
    var ns = 'cluster_page.deployment_history_tab.';
    var deployments = cluster.get('deployments').filter((deployment) => !deployment.isActive());
    return (
      <div className='wrapper'>
        <Input
          type='select'
          name='deployments'
          value={activeDeploymentHistoryId}
          label={i18n(ns + 'select_deployment')}
          onChange={this.showDeploymentHistory}
        >
          {_.map(deployments, (deployment) => (
            <option key={deployment.id} value={deployment.id}>
              {i18n(ns + 'deployment_label', {
                id: deployment.id,
                startTime: utils.formatTimestamp(deployment.get('time_start'))
              })}
            </option>
          ))}
        </Input>
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

export default DeploymentHistoryTab;
