/*
 * Copyright 2015 Mirantis, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License'); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
**/
import $ from 'jquery';
import _ from 'underscore';
import i18n from 'i18n';
import React from 'react';
import utils from 'utils';
import models from 'models';
import dispatcher from 'dispatcher';
import {backboneMixin, pollingMixin, dispatcherMixin} from 'component_mixins';
import DashboardTab from 'views/cluster_page_tabs/dashboard_tab';
import HistoryTab from 'views/cluster_page_tabs/history_tab';
import NodesTab from 'views/cluster_page_tabs/nodes_tab';
import NetworkTab from 'views/cluster_page_tabs/network_tab';
import SettingsTab from 'views/cluster_page_tabs/settings_tab';
import LogsTab from 'views/cluster_page_tabs/logs_tab';
import HealthCheckTab from 'views/cluster_page_tabs/healthcheck_tab';
import {VmWareTab, VmWareModels} from 'plugins/vmware/vmware';

var ClusterPage = React.createClass({
  mixins: [
    pollingMixin(5),
    backboneMixin('cluster', 'change:name change:is_customized change:release'),
    backboneMixin({
      modelOrCollection: (props) => props.cluster.get('nodes')
    }),
    backboneMixin({
      modelOrCollection: (props) => props.cluster.get('tasks'),
      renderOn: 'update change'
    }),
    dispatcherMixin('networkConfigurationUpdated', 'removeFinishedNetworkTasks'),
    dispatcherMixin('deploymentTasksUpdated', 'removeFinishedDeploymentTasks'),
    dispatcherMixin('deploymentTaskStarted', function() {
      this.refreshCluster().then(this.startPolling, this.startPolling);
    }),
    dispatcherMixin('networkVerificationTaskStarted', function() {
      this.startPolling();
    }),
    dispatcherMixin('deploymentTaskFinished', function() {
      this.refreshCluster().then(
        () => dispatcher.trigger('updateNotifications'),
        () => dispatcher.trigger('updateNotifications')
      );
    })
  ],
  statics: {
    navbarActiveElement: 'clusters',
    breadcrumbsPath(pageOptions) {
      var {activeTab, cluster} = pageOptions;
      var breadcrumbs = [
        ['home', '#'],
        ['environments', '#clusters'],
        [cluster.get('name'), '#cluster/' + cluster.get('id'), {skipTranslation: true}]
      ];
      return breadcrumbs.concat(
          _.find(this.getTabs(), {url: activeTab}).tab.breadcrumbsPath(pageOptions)
        );
    },
    title(pageOptions) {
      return pageOptions.cluster.get('name');
    },
    getTabs() {
      return [
        {url: 'dashboard', tab: DashboardTab},
        {url: 'nodes', tab: NodesTab},
        {url: 'network', tab: NetworkTab},
        {url: 'settings', tab: SettingsTab},
        {url: 'vmware', tab: VmWareTab},
        {url: 'logs', tab: LogsTab},
        {url: 'history', tab: HistoryTab},
        {url: 'healthcheck', tab: HealthCheckTab}
      ];
    },
    fetchData(id, activeTab, ...tabOptions) {
      id = Number(id);
      var cluster, promise, currentClusterId, currentTab;
      var tab = _.find(this.getTabs(), {url: activeTab}).tab;
      try {
        currentClusterId = app.page.props.cluster.id;
        currentTab = app.page.props.activeTab;
      } catch (ignore) {}

      if (currentClusterId === id) {
        // just another tab has been chosen, do not load cluster again
        cluster = app.page.props.cluster;
        // do not load tab data if just another subtab has been chosen
        promise = (_.isUndefined(currentTab) || currentTab !== activeTab) && tab.fetchData ?
          tab.fetchData({cluster, tabOptions})
        :
          $.Deferred().resolve();
      } else {
        cluster = new models.Cluster({id: id});
        var baseUrl = _.result(cluster, 'url');

        var settings = new models.Settings();
        settings.url = baseUrl + '/attributes';
        cluster.set({settings});

        var roles = new models.Roles();
        roles.url = baseUrl + '/roles';
        cluster.set({roles});

        var pluginLinks = new models.PluginLinks();
        pluginLinks.url = baseUrl + '/plugin_links';
        cluster.set({pluginLinks});

        var deployments = new models.Deployments();
        cluster.set({deployments});
        // FIXME(jaranovich): task_name filter doesn't work
        //cluster.get('deployments').fetch = function(options) {
        //  return this.constructor.__super__.fetch.call(this,
        //    _.extend({data: {cluster_id: id, task_name: 'deployment'}}, options));
        //};

        cluster.get('nodeNetworkGroups').fetch = function(options) {
          return this.constructor.__super__.fetch.call(this,
            _.extend({data: {cluster_id: id}}, options));
        };
        cluster.get('nodes').fetch = function(options) {
          return this.constructor.__super__.fetch.call(this,
            _.extend({data: {cluster_id: id}}, options));
        };

        promise = $.when(
            cluster.fetch(),
            cluster.get('settings').fetch(),
            cluster.get('roles').fetch(),
            cluster.get('pluginLinks').fetch({cache: true}),
            cluster.fetchRelated('deployments'),
            cluster.fetchRelated('nodes'),
            cluster.fetchRelated('tasks'),
            cluster.fetchRelated('nodeNetworkGroups')
          )
          .then(() => {
            var networkConfiguration = new models.NetworkConfiguration();
            networkConfiguration.url = baseUrl + '/network_configuration/' +
              cluster.get('net_provider');

            cluster.set({
              networkConfiguration,
              release: new models.Release({id: cluster.get('release_id')})
            });

            return $.when(
              cluster.get('networkConfiguration').fetch(),
              cluster.get('release').fetch()
            );
          })
          .then(() => {
            if (!cluster.get('settings').get('common.use_vcenter.value')) return true;

            var vcenter = new VmWareModels.VCenter({id: id});
            cluster.set({vcenter});
            return vcenter.fetch();
          })
          .then(() => {
            var deployedSettings = new models.Settings();
            deployedSettings.url = baseUrl + '/attributes/deployed';

            var deployedNetworkConfiguration = new models.NetworkConfiguration();
            deployedNetworkConfiguration.url = baseUrl +
              '/network_configuration/deployed';

            cluster.set({deployedSettings, deployedNetworkConfiguration});

            if (cluster.get('status') === 'new') return $.Deferred().resolve();
            return $.when(
              cluster.get('deployedSettings').fetch(),
              cluster.get('deployedNetworkConfiguration').fetch()
            )
            .catch(() => true);
          })
          .then(
            () => tab.fetchData ? tab.fetchData({cluster, tabOptions}) : $.Deferred().resolve()
          );
      }
      return promise.then(
        (tabData) => ({cluster, activeTab, tabOptions, tabData})
      );
    }
  },
  getDefaultProps() {
    return {
      defaultLogLevel: 'INFO'
    };
  },
  getInitialState() {
    var tabs = this.constructor.getTabs();
    var selectedNodes = utils.deserializeTabOptions(this.props.tabOptions[1]).nodes;
    var states = {
      selectedNodeIds: selectedNodes ?
        _.reduce(selectedNodes.split(','), (result, id) => {
          result[Number(id)] = true;
          return result;
        }, {})
      :
        {},
      showAllNetworks: false
    };
    _.each(tabs, (tabData) => {
      if (tabData.tab.checkSubroute) _.extend(states, tabData.tab.checkSubroute(this.props));
    });
    return states;
  },
  removeFinishedNetworkTasks(callback) {
    var request = this.removeFinishedTasks(this.props.cluster.tasks({group: 'network'}));
    if (callback) request.then(callback, callback);
    return request;
  },
  removeFinishedDeploymentTasks() {
    return this.removeFinishedTasks(this.props.cluster.tasks({group: 'deployment'}));
  },
  removeFinishedTasks(tasks) {
    var requests = [];
    _.each(tasks, (task) => {
      if (task.match({active: false})) {
        this.props.cluster.get('tasks').remove(task);
        requests.push(task.destroy({silent: true}));
      }
    });
    return $.when(...requests);
  },
  shouldDataBeFetched() {
    return this.props.cluster.task({group: ['deployment', 'network'], active: true});
  },
  fetchData() {
    var task = this.props.cluster.task({group: 'deployment', active: true});
    if (task) {
      return task.fetch()
        .then(() => {
          if (task.match({active: false})) dispatcher.trigger('deploymentTaskFinished');
          return this.props.cluster.fetchRelated('nodes');
        });
    } else {
      task = this.props.cluster.task({name: 'verify_networks', active: true});
      return task ? task.fetch() : $.Deferred().resolve();
    }
  },
  refreshCluster() {
    var {cluster} = this.props;
    return $.when(
      cluster.fetch(),
      cluster.fetchRelated('nodes'),
      cluster.fetchRelated('tasks'),
      cluster.get('networkConfiguration').fetch(),
      cluster.get('pluginLinks').fetch()
    )
    .then(() => {
      if (cluster.get('status') === 'new') return $.Deferred().resolve();
      return $.when(
        cluster.fetchRelated('deployments'),
        cluster.get('deployedNetworkConfiguration').fetch(),
        cluster.get('deployedSettings').fetch()
      )
      .catch(() => true);
    });
  },
  componentWillMount() {
    this.props.cluster.on('change:release_id', () => {
      var release = new models.Release({id: this.props.cluster.get('release_id')});
      release.fetch().then(() => {
        this.props.cluster.set({release});
      });
    });
  },
  componentWillReceiveProps(newProps) {
    var tab = _.find(this.constructor.getTabs(), {url: newProps.activeTab}).tab;
    if (tab.checkSubroute) {
      this.setState(tab.checkSubroute(_.extend({}, newProps, {
        showAllNetworks: this.state.showAllNetworks
      })));
    }
  },
  changeLogSelection(selectedLogs) {
    this.setState({selectedLogs});
  },
  getAvailableTabs(cluster) {
    return _.filter(this.constructor.getTabs(),
      (tabData) => !tabData.tab.isVisible || tabData.tab.isVisible(cluster));
  },
  selectNodes(selectedNodeIds) {
    this.setState({selectedNodeIds});
  },
  render() {
    var cluster = this.props.cluster;
    var availableTabs = this.getAvailableTabs(cluster);
    var tabUrls = _.map(availableTabs, 'url');
    var subroutes = {
      settings: this.state.activeSettingsSectionName,
      network: this.state.activeNetworkSectionName,
      logs: utils.serializeTabOptions(this.state.selectedLogs),
      history: this.state.activeDeploymentHistoryId
    };
    var tab = _.find(availableTabs, {url: this.props.activeTab});
    if (!tab) return null;
    var Tab = tab.tab;

    return (
      <div className='cluster-page' key={cluster.id}>
        <div className='page-title'>
          <h1 className='title'>
            {cluster.get('name')}
            <div
              className='title-node-count'
            >
              ({i18n('common.node', {count: cluster.get('nodes').length})})
            </div>
          </h1>
        </div>
        <div className='tabs-box'>
          <div className='tabs'>
            {tabUrls.map((tabUrl) => {
              var url = '#cluster/' + cluster.id + '/' + tabUrl +
                (subroutes[tabUrl] ? '/' + subroutes[tabUrl] : '');
              return (
                <a
                  key={tabUrl}
                  className={
                    tabUrl + ' ' + utils.classNames({
                      'cluster-tab': true,
                      active: this.props.activeTab === tabUrl
                    })
                  }
                  href={url}
                >
                  <div className='icon' />
                  <div className='label'>{i18n('cluster_page.tabs.' + tabUrl)}</div>
                </a>
              );
            })}
          </div>
        </div>
        <div key={tab.url + cluster.id} className={'content-box tab-content ' + tab.url + '-tab'}>
          <Tab
            ref='tab'
            {... _.pick(this, 'selectNodes', 'changeLogSelection')}
            {... _.pick(this.props, 'cluster', 'tabOptions')}
            {...this.state}
            {...this.props.tabData}
          />
        </div>
      </div>
    );
  }
});

export default ClusterPage;
